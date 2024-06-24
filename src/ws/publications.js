import { CollectionMapPublication, Publication } from "insite-subscriptions-server";


export class AbilitiesPublication extends Publication {
	constructor(abilities) {
		super("abilities", {
			
			fetch({ user }) {
				if (user?.abilities.login?.sections?.includes("users"))
					return { abilities: abilities.getSchemeFor(user) };
				
				return null;
			}
			
		});
	}
}


export class RolesPublication extends CollectionMapPublication {
	constructor(roles, options = {}) {
		
		const {
			projection = { title: 1, description: 1 },
			sort = { _o: 1 },
			transform
		} = options;
		
		Object.assign(projection, { involves: 1, abilities: 1 });
		
		super("roles", roles.collection, ws => ws.user?.abilities.login?.sections?.includes("users") && {
			query: { _id: { $in: ws.user.slaveRoleIds } },
			projection,
			sort
		}, roleDoc => {
			const { involves, abilities, inheritedAbilities, displayTitle, _o } = roles.get(roleDoc._id);
			
			if (roleDoc.involves) {
				roleDoc.ownInvolves = roleDoc.involves;
				roleDoc.involves = involves.ids();
				roleDoc.abilities = abilities;
				roleDoc.inheritedAbilities = inheritedAbilities;
			}
			
			if (projection.title)
				roleDoc.displayTitle = displayTitle;
			
			roleDoc._o = _o;
			
			transform?.(roleDoc);
			
		});
		
	}
	
}


export class UserPublication extends Publication {
	constructor(users, options = {}) {
		
		const {
			fieldsToUpdate = [],
			projection,
			transform
		} = options;
		
		for (const key of [
			"email",
			"name",
			"name.first",
			"name.middle",
			"name.last",
			"org",
			"job",
			"avatar"
		])
			if (!projection || projection[key] !== 0)
				fieldsToUpdate.push(key);
		
		super("user", {
			
			onSubscribe(subscription) {
				const [ { user } ] = subscription.args;
				
				if (user) {
					const { _id } = user;
					
					subscription.changeListener = next => {
						if (next.documentKey._id === _id)
							switch (next.operationType) {
								case "update":
									if (!Object.keys(next.updateDescription.updatedFields).includesAny(fieldsToUpdate))
										break;
								
								case "replace":// eslint-disable-line no-fallthrough
								case "delete":
									subscription.changed(next);
							}
						
					};
					
					users.collection.changeListeners.add(subscription.changeListener);
				}
				
			},
			
			fetch({ user, session }, isSessionIdRequired) {
				if (user) {
					const userDoc = Object.pick(user, "_id", "email", "name", "initials", "displayLabel", "job", "avatarUrl", "abilities", "slaveIds");
					
					userDoc.orgId = user.org._id;
					userDoc.sessionId = isSessionIdRequired ? session._id : undefined;
					userDoc.isOnline = true;
					
					if (projection)
						for (const key in projection)
							if (projection[key])
								userDoc[key] = user[key];
							else
								delete userDoc[key];
					
					transform?.(userDoc);
					
					return userDoc;
				}
				
				return null;
			},
			
			onUnsubscribe(subscription) {
				if (subscription.changeListener)
					users.collection.changeListeners.delete(subscription.changeListener);
				
			}
			
		});
		
	}
}

export class UsersPublication extends CollectionMapPublication {
	constructor(users, options = {}) {
		
		const {
			projection = { email: 1, name: 1, org: 1, job: 1, avatar: 1 },
			sort = { "name.last": 1 },
			transform
		} = options;
		
		super("users", users.collection, ws => ws.user?.abilities.login && {
			query: {},
			projection,
			sort
		}, userDoc => {
			({
				initials: userDoc.initials,
				displayLabel: userDoc.displayLabel,
				avatarUrl: userDoc.avatarUrl,
				isOnline: userDoc.isOnline
			} = users.get(userDoc._id));
			
			userDoc.orgId = userDoc.org;
			
			delete userDoc.org;
			delete userDoc.avatar;
			
			transform?.(userDoc);
			
		});
		
	}
}

export class UsersExtendedPublication extends CollectionMapPublication {
	constructor(users, options = {}) {
		
		const {
			projection = { _id: 1 },
			sort,
			triggers = [],
			transform
		} = options;
		
		if (!triggers.includes("roles"))
			triggers.push("roles");
		
		super("users.extended", users.collection, ws => ws.user?.abilities.login?.sections?.includes("users") && {
			query: { _id: { $in: ws.user.slaveIds } },
			projection,
			sort,
			triggers
		}, (userDoc, [ ws ]) => {
			userDoc.roleIds = users.get(userDoc._id).ownRoleIds.intersection(ws.user.slaveRoleIds);
			
			transform?.(userDoc);
			
		});
		
	}
}


export class SessionsPublication extends CollectionMapPublication {
	constructor(sessions) {
		super("users.people.sessions", sessions.collection, (ws, userId) =>
			ws.user?.abilities.login?.sections?.includes("users") && ws.user.permissiveIds.includes(userId) && {
				query: { user: userId },
				projection: { remoteAddress: 1, isOnline: 1, prolongedAt: 1 },
				sort: { prolongedAt: -1 }
			}
		);
	}
}


export class OrgsPublication extends CollectionMapPublication {
	constructor(orgs, options = {}) {
		
		const {
			projection = { title: 1 },
			sort = { title: 1 },
			transform
		} = options;
		
		super("orgs", orgs.collection, ws => ws.user?.abilities.login && {
			query: {},
			projection,
			sort
		}, orgDoc => {
			({
				initials: orgDoc.initials,
				displayLabel: orgDoc.displayLabel
			} = orgs.get(orgDoc._id));
			
			transform?.(orgDoc);
			
		});
		
	}
	
}

export class OrgsExtendedPublication extends CollectionMapPublication {
	constructor(orgs, options = {}) {
		
		const {
			projection = { note: 1 },
			sort = { _o: 1 },
			triggers = [],
			transform
		} = options;
		
		if (!triggers.includes("owners"))
			triggers.push("owners");
		
		super("orgs.extended", orgs.collection, ws => ws.user?.abilities.login?.sections?.includes("users") && {
			query: { _id: { $in: ws.user.slaveIds } },
			projection,
			sort,
			triggers
		}, (orgDoc, [ ws ]) => {
			const { ownerIds, slaveOrgs, _o } = orgs.get(orgDoc._id);
			
			orgDoc.owners = ownerIds.intersection(ws.user.slaveIds);
			orgDoc.slaveOrgs = slaveOrgs.intersection(ws.user.slaveOrgs).ids();
			orgDoc._o = _o;
			
			transform?.(orgDoc);
			
		});
		
	}
	
}
