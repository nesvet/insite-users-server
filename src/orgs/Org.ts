import type { AbilitiesSchema } from "insite-common";
import type { ChangeStreamDocument } from "insite-db";
import { User } from "../users/User";
import type { Orgs } from "./Orgs";
import type { OrgDoc } from "./types";


const snapshots = new Map();


export class Org<AS extends AbilitiesSchema> {
	constructor(orgs: Orgs<AS>, orgDoc: OrgDoc) {
		this.orgs = orgs;
		
		this._id = orgDoc._id;
		orgs.set(this._id, this);
		
		void this.update(orgDoc);
		
	}
	
	_id;
	title = "";
	initials = "";
	displayLabel = "";
	
	_o = 0;
	
	orgs;
	
	isOrg = true;
	
	ownerOrgs = new Set<Org<AS>>();
	ownerUsers = new Set<User<AS>>();
	
	users = new Set<User<AS>>();
	
	slaveOrgs = new Set<Org<AS>>();
	
	ownerIds: string[] = [];
	
	update({ _id, title, owners: ownerIds, ...restProps }: Partial<OrgDoc>, next?: ChangeStreamDocument<OrgDoc>) {
		
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
				
				if (this.orgs.users.isInited)
					this.orgs.updateDebounced();
				
				this.orgs.users.emit("orgs-org-update", this, next);
			}
		}
		
	}
	
	delete() {
		
		this.orgs.delete(this._id);
		
		snapshots.delete(this._id);
		
		this.orgs.replace(this._id);
		
		this.orgs.updateDebounced();
		
	}
	
}
