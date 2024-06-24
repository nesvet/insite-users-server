import { Err } from "@nesvet/n";
import { Binary } from "insite-db";
import { regexps } from "../lib";


const avatarTypesAccepted = [ "image/webp" ];
const maxAvatarSize = 1024 * 512;


export function setupHandlers(users, wss) {
	
	/*
	 * Users
	 */
	
	wss.on("client-request:users.people.check-email", (ws, email) => {
		if (ws.user?.abilities.login?.sections?.includes("users")) {
			if (!regexps.email.test(email))
				throw new Err("Not email", "notemail");
			
			if (users.byEmail.has(email))
				throw new Err("Email already exists", "exists");
		}
		
	});
	
	wss.on("client-request:users.people.add", async (ws, { roles, org, ...rest }) => {
		if (ws.user?.abilities.login?.sections?.includes("users")) {
			if (!roles.length)
				throw new Err("Roles shouldn't be empty", "emptyroles");
			
			if (!ws.user.slaveRoleIds.includesAll(roles))
				throw new Err("Can't assign role the user is not involved in", "forbiddenrole");
			
			if (org && !ws.user.slaveIds.includes(org))
				throw new Err("Can't assign org the user is not master of", "forbiddenorg");
			
			await users.new({ roles, org, ...rest });
		}
		
	});
	
	wss.on("client-request:users.people.change-password", async (ws, _id, newPassword) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.permissiveIds.includes(_id)) {
			if (typeof newPassword != "string")
				throw new Err("Type of password is incorrect", "wrongpasswordtype");
			
			if (!newPassword)
				throw new Err("Password can't be empty", "emptypassword");
			
			await users.changePassword(_id, newPassword);
		}
		
	});
	
	wss.on("client-request:users.people.update", async (ws, _id, updates) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.permissiveIds.includes(_id)) {
			if (updates.roles) {
				if (!updates.roles.length)
					throw new Err("Roles can't be empty", "emptyroles");
				
				if (!ws.user.slaveRoleIds.includesAll(updates.roles))
					throw new Err("Can't assign role the user is not involved in", "forbiddenrole");
				
				const user = users.get(_id);
				
				updates.roles = user.isRoot ? [ "root" ] : users.roles.cleanUpIds(user.ownRoleIds.without(ws.user.slaveRoleIds).concat(updates.roles));
			}
			
			if (updates.org && !ws.user.slaveIds.includes(updates.org))
				throw new Err("Can't assign org the user is not master of", "forbiddenorg");
			
			await users.collection.updateOne({ _id }, { $set: updates });
		}
		
	});
	
	wss.on("client-request:users.people.delete", async (ws, _id) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.slaveIds.includes(_id))
			await users.collection.deleteOne({ _id });
		
	});
	
	
	/*
	 * Sessions
	 */
	
	wss.on("client-request:users.people.destroy-session", async (ws, sessionId) => {
		if (
			ws.user?.abilities.login?.sections?.includes("users") &&
			ws.user.permissiveIds.includes(users.bySessionId.get(sessionId)?._id)
		)
			await users.sessions.collection.deleteOne({ _id: sessionId });
		
	});
	
	
	/*
	 * Avatars
	 */
	
	if (wss.incomingTransport) {
		function getAvatarTransferProps(check) {
			return {
				
				async begin(ws, transfer) {
					return (
						(!check || await check(ws, transfer)) &&
						avatarTypesAccepted.includes(transfer.metadata.type) &&
						transfer.size <= maxAvatarSize
					);
				},
				
				async end(_, { data, metadata: { type, _id } }) {
					data = Binary.createFromBase64(data.slice(data.indexOf(",")));
					
					const ts = Date.now().toString(36);
					
					await Promise.all([
						users.avatars.collection.replaceOne({ _id }, {
							_id,
							type,
							size: data.length(),
							ts,
							data
						}, { upsert: true }),
						users.collection.updateOne({ _id }, { $set: { avatar: ts } })
					]);
					
				}
				
			};
		}
		
		wss.on("client-transfer:users.people.avatar", getAvatarTransferProps((ws, { metadata: { _id } }) =>
			ws.user?.abilities.login?.sections?.includes("users") &&
			ws.user.permissiveIds.includes(_id))
		);
		
		wss.on("client-transfer:user.avatar", getAvatarTransferProps((ws, transfer) =>
			ws.user &&
			ws.user._id === transfer.metadata._id
		));
	}
	
	async function deleteAvatar(_id) {
		
		await Promise.all([
			users.avatars.collection.deleteOne({ _id }),
			users.collection.updateOne({ _id }, { $set: { avatar: null } })
		]);
		
	}
	
	wss.on("client-request:users.people.delete-avatar", async (ws, _id) =>
		ws.user?.abilities.login?.sections?.includes("users") &&
		ws.user.permissiveIds.includes(_id) &&
		await deleteAvatar(_id)
	);
	
	wss.on("client-request:user.delete-avatar", async (ws, _id) =>
		ws.user &&
		ws.user._id === _id &&
		await deleteAvatar(_id)
	);
	
	
	/*
	 * Orgs
	 */
	
	wss.on("client-request:users.orgs.add", async (ws, org) => {
		if (ws.user?.abilities.login?.sections?.includes("users")) {
			if (!org.title)
				throw new Err("Title can't be empty", "emptytitle");
			
			await users.orgs.new(org, ws.user._id);
		}
		
	});
	
	wss.on("client-request:users.orgs.update", async (ws, _id, updates) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.slaveIds.includes(_id)) {
			if (updates.title !== undefined && !updates.title)
				throw new Err("Title can't be empty", "emptytitle");
			
			if (updates.owners) {
				if (!ws.user.slaveIds.includesAll(updates.owners))
					throw new Err("Can't assign owners the user is not master of", "forbiddenowners");
				
				const org = users.orgs.get(_id);
				
				updates.owners = users.sortIds(org.ownerIds.without(ws.user.slaveIds).with(updates.owners.without([ org._id, ...org.slaveOrgs.ids() ])));
			}
			
			await users.orgs.collection.updateOne({ _id }, { $set: updates });
		}
		
	});
	
	wss.on("client-request:users.orgs.delete", async (ws, _id) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.slaveIds.includes(_id))
			await users.orgs.collectionDelete(_id);
		
	});
	
	
	/*
	 * Roles
	 */
	
	wss.on("client-request:users.roles.check-id", (ws, _id) => {
		if (ws.user?.abilities.login?.sections?.includes("users")) {
			if (!regexps.role.test(_id))
				throw new Err("Role ID is incorrect", "notroleid");
			
			if (users.roles.has(_id))
				throw new Err("Role ID already exists", "exists");
		}
		
	});
	
	wss.on("client-request:users.roles.add", async (ws, role) => {
		if (ws.user?.abilities.login?.sections?.includes("users"))
			await users.roles.new(role);
		
	});
	
	wss.on("client-request:users.roles.update", async (ws, _id, { abilities, ...updates }) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.slaveRoleIds.includes(_id)) {
			if (updates.involves)
				if (ws.user.slaveRoleIds.includesAll(updates.involves)) {
					updates.involves.remove(_id);
					
					const role = users.roles.get(_id);
					for (const involvedRoleId of updates.involves)
						if (users.roles.get(involvedRoleId).involves.has(role))
							updates.involves.remove(involvedRoleId);
					
					updates.involves = users.roles.cleanUpIds(updates.involves);
				} else
					throw new Err("Can't assign role the user is not involved in", "forbiddenrole");
			
			await users.roles.collection.updateOne({ _id }, { $set: updates });
		}
		
	});
	
	wss.on("client-request:users.roles.set-ability", async (ws, _id, abilityId, paramId, value) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.slaveRoleIds.includes(_id) && ws.user.abilities[abilityId]) {
			const abilities = structuredClone(users.roles.get(_id).ownAbilities);
			let shouldUpdate;
			
			if (paramId) {
				if (!abilities[abilityId])
					abilities[abilityId] = {};
				const param = users.abilities.get(abilityId).params?.find(anotherParam => anotherParam._id === paramId);
				if (param)
					if (param.type === "number") {
						if (ws.user.abilities[abilityId][paramId] >= value) {
							abilities[abilityId][paramId] = value;
							shouldUpdate = true;
						}
					} else if (param.type === "items" && ws.user.abilities[abilityId][paramId]?.includesAll(value)) {
						abilities[abilityId][paramId] = value;
						shouldUpdate = true;
					}
			} else {
				if (value)
					abilities[abilityId] = users.abilities.getMinimumOf(abilityId);
				else
					(function resolve(schema) {
						delete abilities[schema._id];
						if (schema.subAbilities)
							for (const subSchema of schema.subAbilities)
								if (abilities[subSchema._id])
									resolve(subSchema);
						
					})(users.abilities.get(abilityId));
				
				shouldUpdate = true;
			}
			
			if (shouldUpdate)
				await users.roles.collection.updateOne({ _id }, { $set: { abilities } });
		}
		
	});
	
	wss.on("client-message:users.roles.delete", async (ws, _id) => {
		if (ws.user?.abilities.login?.sections?.includes("users") && ws.user.slaveRoleIds.includes(_id))
			await users.roles.collectionDelete(_id);
		
	});
	
}
