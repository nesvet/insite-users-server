const snapshots = new Map();


export class Org {
	constructor(orgs, orgDoc) {
		this.#orgs = orgs;
		
		this._id = orgDoc._id;
		orgs.set(this._id, this);
		
		this.update(orgDoc);
		
	}
	
	#orgs;
	
	isOrg = true;
	
	ownerOrgs = new Set();
	ownerUsers = new Set();
	
	users = new Set();
	
	slaveOrgs = new Set();
	
	update({ _id, title, owners: ownerIds, ...restProps }, next) {
		
		const orgs = this.#orgs;
		
		Object.assign(this, restProps);
		
		if (title !== undefined) {
			this.title = title;
			this.initials = title?.[0]?.toUpperCase() ?? "";
			this.displayLabel = title;
		}
		
		if (ownerIds) {
			this.ownerIds = ownerIds;
			
			
			const snapshot = this.ownerIds.join(",");
			
			if (snapshot !== snapshots.get(this._id)) {
				snapshots.set(this._id, snapshot);
				
				if (orgs.users.isInited)
					orgs.updateDebounced();
				
				orgs.users.emit("orgs-org-update", this, next);
			}
		}
		
	}
	
	delete() {
		
		const orgs = this.#orgs;
		
		orgs.delete(this._id);
		
		snapshots.delete(this._id);
		
		orgs.replace(this._id);
		
		orgs.updateDebounced();
		
	}
	
}
