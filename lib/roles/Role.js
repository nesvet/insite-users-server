const snapshots = new Map();


export class Role {
	constructor(roles, roleDoc) {
		this.#roles = roles;
		
		this._id = roleDoc._id;
		roles.set(this._id, this);
		
		this.update(roleDoc);
		
	}
	
	#roles;
	
	ownInvolves = [];
	involves = new Set();
	abilities = {};
	inheritedAbilities = {};
	
	update({ _id, involves: ownInvolveIds, abilities: ownAbilities, title, ...restProps }, next) {
		
		const roles = this.#roles;
		
		Object.assign(this, restProps);
		
		if (ownInvolveIds)
			this.ownInvolveIds = ownInvolveIds;
		
		if (ownAbilities)
			this.ownAbilities = ownAbilities;
		
		if (title !== undefined) {
			this.title = title;
			this.displayTitle = title || this._id;
		}
		
		
		if (ownInvolveIds || ownAbilities) {
			const snapshot = [
				this.ownInvolveIds.join(","),
				JSON.stringify(this.ownAbilities)
			].join("\n");
			
			if (snapshot != snapshots.get(this._id)) {
				snapshots.set(this._id, snapshot);
				
				if (roles.users.isInited)
					roles.updateDebounced();
				
				roles.users.emit("roles-role-update", next);
			}
		}
		
	}
	
	delete() {
		
		const roles = this.#roles;
		
		roles.delete(this._id);
		
		snapshots.delete(this._id);
		
		roles.updateDebounced();
		
	}
	
}
