import {
	AbilitiesPublication,
	RolesPublication,
	UserPublication,
	UsersPublication,
	UsersExtendedPublication,
	OrgsPublication,
	OrgsExtendedPublication
} from "./publications";


export class UsersServer {
	constructor(wss, options = {}) {
		wss.usersServer = this;
		
		const {
			users,
			publication: publicationOptions,
			extendedPublication: extendedPublicationOptions,
			userPublication: userPublicationOptions,
			roles = {},
			orgs = {},
			getSessionProps
		} = options;
		
		const {
			publication: rolesPublicationOptions
		} = roles;
		
		const {
			publication: orgsPublicationOptions,
			extendedPublication: orgsExtendedPublicationOptions
		} = orgs;
		
		this.users = users;
		this.getSessionProps = getSessionProps;
		
		for (const user of users.values())
			UsersServer.handleUserCreate(user);
		
		users.abilities.publication = new AbilitiesPublication(users.abilities);
		
		users.roles.publication = new RolesPublication(users.roles, rolesPublicationOptions);
		users.on("roles-update", UsersServer.handleRolesUpdate);
		users.on("roles-role-update", UsersServer.handleRolesRoleUpdate);
		
		users.publication = new UsersPublication(users, publicationOptions);
		users.extendedPublication = new UsersExtendedPublication(users, extendedPublicationOptions);
		users.userPublication = new UserPublication(users, userPublicationOptions);
		users.on("user-create", UsersServer.handleUserCreate);
		users.on("user-is-online", UsersServer.handleUserIsOnline);
		
		users.on("session-delete", this.#handleSessionDelete);
		
		users.orgs.publication = new OrgsPublication(users.orgs, orgsPublicationOptions);
		users.orgs.extendedPublication = new OrgsExtendedPublication(users.orgs, orgsExtendedPublicationOptions);
		users.on("orgs-update", UsersServer.handleOrgsUpdate);
		users.on("orgs-org-update", UsersServer.handleOrgsOrgUpdate);
		
		wss.options.WebSocket.prototype.login = UsersServer.login;
		wss.options.WebSocket.prototype.logout = UsersServer.logout;
		wss.options.WebSocket.prototype.setSession = UsersServer.setSession;
		
		wss.on("client-connect", UsersServer.handleClientConnect);
		
		if (wss.requestListener) {
			wss.on("client-request:login", UsersServer.handleClientRequestLogin);
			wss.on("client-request:logout", UsersServer.handleClientRequestLogout);
		}
		
		wss.on("client-closed", UsersServer.handleClientClosed);
		
	}
	
	wsBySessions = new Map();
	
	getDefaultSessionProps({ userAgent, remoteAddress }) {
		return {
			userAgent,
			remoteAddress
		};
	}
	
	
	static handleUserCreate(user) {
		user.webSockets = new Set();
		
	}
	
	static handleUserIsOnline({ _id, isOnline }) {
		const updates = { _id, isOnline };
		
		for (const usersSubscription of this.publication.subscriptions) {
			const [ ws ] = usersSubscription.args;
			if (ws.user && ws.user._id != _id)
				usersSubscription.handler([ [ "u"/* update */, updates, true ] ]);
		}
		
	}
	
	#handleSessionDelete = session => this.wsBySessions.get(session)?.setSession(null);
	
	static handleRolesUpdate() {
		this.roles.publication.flushInitial();
		
	}
	
	static handleRolesRoleUpdate(_, next) {
		if (next)
			this.roles.publication.skip(next);
		
	}
	
	static handleOrgsUpdate() {
		
		this.orgs.publication.flushInitial();
		this.orgs.extendedPublication.flushInitial();
		
	}
	
	static handleOrgsOrgUpdate(_, next) {
		if (next) {
			this.orgs.publication.skip(next);
			this.orgs.extendedPublication.skip(next);
		}
		
	}
	
	
	static handleClientConnect(ws) {
		ws.session = null;
		
	}
	
	static handleClientRequestLogin(ws, email, password) {
		return ws.login(email, password);
	}
	
	static handleClientRequestLogout(ws) {
		return ws.logout();
	}
	
	static handleClientClosed(ws) {
		ws.session?.offline();
		ws.setSession(null);
		
	}
	
	
	static async login(email, password) {
		
		const { usersServer } = this.wss;
		
		const session = await usersServer.users.login(email, password, {
			...usersServer.getDefaultSessionProps(this),
			...usersServer.getSessionProps?.(this),
			isOnline: true
		});
		
		if (session)
			this.setSession(session);
		
	}
	
	static logout() {
		if (this.session) {
			this.wss.usersServer.users.logout(this.session);
			this.setSession(null);
		}
		
	}
	
	
	static setSession(session, shouldProlong) {
		
		const { usersServer } = this.wss;
		
		if (typeof session == "string")
			session = usersServer.users.sessions.get(session) ?? null;
		
		if (this.session != session) {
			if (this.session)
				usersServer.wsBySessions.delete(this.session);
			
			if (session) {
				this.session = session;
				this.user = session.user;
				this.lastUserId = this.user._id;
				
				this.user.webSockets.add(this);
				usersServer.wsBySessions.set(session, this);
				
				if (shouldProlong)
					session.prolong({
						...usersServer.getDefaultSessionProps(this),
						...usersServer.getSessionProps?.(this),
						isOnline: true
					});
				
			} else {
				this.user.webSockets.delete(this);
				
				this.session = null;
				delete this.user;
			}
			
			this.wss.emit("client-session", this, shouldProlong);
		}
		
	}
	
}
