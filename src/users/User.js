import { debounce } from "@nesvet/n";


const rolesSnapshots = new Map();
const permissionsSnapshots = new Map();

const staticHost = process.env.STATIC_HOST ?? "localhost";


export class User {
	constructor(users, userDoc) {
		this.#users = users;
		
		this._id = userDoc._id;
		users.set(this._id, this);
		
		this.update(userDoc);
		
		if (users.isInited)
			users.emit("user-create", this);
		
	}
	
	#users;
	
	isUser = true;
	
	roles = new Set();
	slaveRoles = new Set();
	slaveRoleIds = [];
	abilities = {};
	
	slaveOrgs = new Set();
	slaveUsers = new Set();
	slaves = new Set();
	
	slaveIds = [];
	permissiveIds = [];
	
	sessions = new Set();
	
	isOnline = false;
	
	update({ _id, name, email, roles: ownRoleIds, org: orgId, avatar, ...restProps }) {
		
		const users = this.#users;
		
		Object.assign(this, restProps);
		
		let isEmailUpdated;
		if (email && this.email !== email) {
			users.byEmail.delete(this.email);
			this.email = email;
			users.byEmail.set(email, this);
			isEmailUpdated = true;
		}
		
		let isNameUpdated;
		let isLastNameUpdated;
		if (name && (this.name?.first !== name.first || this.name.middle !== name.middle || this.name.last !== name.last)) {
			isLastNameUpdated = this.name?.last !== name.last;
			this.name = {
				first: name.first,
				middle: name.middle,
				last: name.last
			};
			this.initials = (((name.first[0] || "") + (name.last[0] || "")) || this.email[0]).toUpperCase();
			isNameUpdated = true;
		}
		
		if (isEmailUpdated || isNameUpdated)
			this.displayLabel = `${name.first} ${name.last}`.trim() || name.middle || this.email;
		
		let isRolesUpdated;
		if (ownRoleIds) {
			this.ownRoleIds = ownRoleIds;
			
			const snapshot = this.ownRoleIds.join(",");
			
			if (snapshot !== rolesSnapshots.get(this._id)) {
				rolesSnapshots.set(this._id, snapshot);
				this.updateRoles();
				isRolesUpdated = true;
			}
		}
		
		let isOrgUpdated;
		if (orgId !== undefined && this.org?._id !== orgId) {
			this.org?.users.delete(this);
			this.org = users.orgs.get(orgId) || users.orgs.null;
			this.org.users.add(this);
			isOrgUpdated = true;
		}
		
		if (avatar !== undefined && this.avatar !== avatar) {
			this.avatar = avatar;
			this.avatarUrl = avatar && `https://${staticHost}/avatars/${this._id}-${avatar}.webp`;
		}
		
		if (isRolesUpdated || isOrgUpdated) {
			this.updatePermissions();
			
			if (isLastNameUpdated)
				users.isSortRequired = true;
			
			if (users.isInited)
				users.updateDebounced();
			
		} else if (isLastNameUpdated)
			users.sortDebounced();
		
	}
	
	updateRoles() {
		
		const users = this.#users;
		
		if (users.isInited) {
			this.ownRoles = [];
			this.roles.clear();
			this.slaveRoles.clear();
			Object.clear(this.abilities);
			
			for (const roleId of this.ownRoleIds) {
				const role = users.roles.get(roleId);
				
				this.ownRoles.push(role);
				this.roles.add(role);
				for (const involvedRole of role.involves) {
					this.roles.add(involvedRole);
					this.slaveRoles.add(involvedRole);
				}
				
				this.slaveRoleIds = this.slaveRoles.ids();
				
				users.abilities.merge(this.abilities, role.abilities);
			}
			
			if (this.roles.has(users.roles.root))
				this.isRoot = true;
			
			this.trimSessions();
		}
		
	}
	
	updatePermissions() {
		
		const users = this.#users;
		
		if (users.isInited) {
			this.slaveOrgs.clear();
			this.slaveUsers.clear();
			this.slaves.clear();
			const slaveIds = new Set();
			
			for (const org of users.orgs.sorted)
				if ((org.ownerUsers.has(this) || this.isRoot) && !this.slaveOrgs.has(org)) {
					this.slaveOrgs.add(org);
					this.slaves.add(org);
					slaveIds.add(org._id);
					for (const slaveOrg of org.slaveOrgs) {
						this.slaveOrgs.add(slaveOrg);
						this.slaves.add(slaveOrg);
						slaveIds.add(slaveOrg._id);
					}
				}
			
			for (const org of new Set([ this.org, ...this.slaveOrgs, users.orgs.null ]))
				for (const user of org.users)
					if (user !== this && (this.slaveRoles.hasAny(user.ownRoles) || !user.ownRoles.length)) {
						this.slaveUsers.add(user);
						this.slaves.add(user);
						slaveIds.add(user._id);
					}
			
			this.slaveIds = [ ...slaveIds ];
			
			const permissiveOrgIds = [];
			if (this.org._id) {
				permissiveOrgIds.push(this.org._id);
				for (const slaveOrg of this.org.slaveOrgs)
					if (!this.slaveOrgs.has(slaveOrg))
						permissiveOrgIds.push(slaveOrg._id);
			}
			
			this.permissiveIds = [ ...permissiveOrgIds, this._id, ...slaveIds ];
			
			
			const snapshot = [
				this.permissiveIds.join(","),
				this.ownRoleIds.join(","),
				JSON.stringify(this.abilities),
				this.slaveRoleIds.join(",")
			].join("\n");
			
			if (snapshot !== permissionsSnapshots.get(this._id)) {
				permissionsSnapshots.set(this._id, snapshot);
				
				users.emit("user-permissions-change", this);
			}
		}
		
	}
	
	trimSessions() {
		
		const sessionsLimit = this.abilities.login?.sessionsLimit ?? 0;
		
		if (this.sessions.size > sessionsLimit)
			return this.#users.sessions.collection.deleteMany({ _id: { $in: [ ...this.sessions ].sort((a, b) => a.expiresAt - b.expiresAt).slice(0, this.sessions.size - sessionsLimit).ids() } });
		
	}
	
	updateIsOnline = debounce(() => {
		
		let isOnline = false;
		
		for (const session of this.sessions)
			if (session.isOnline) {
				isOnline = true;
				break;
			}
		
		if (this.isOnline !== isOnline) {
			this.isOnline = isOnline;
			this.#users.emit("user-is-online", this);
		}
		
	}, 500);
	
	delete() {
		
		const users = this.#users;
		
		this.org.users.delete(this);
		
		users.delete(this._id);
		users.byEmail.delete(this.email);
		users.sorted.remove(this);
		
		rolesSnapshots.delete(this._id);
		permissionsSnapshots.delete(this._id);
		
		users.replace(this._id);
		
		users.updateDebounced();
		
	}
	
}
