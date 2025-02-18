import { Err } from "@nesvet/n";


export class RolesError extends Err {
	constructor(roleId: string, payload?: object);
	constructor(roleIds: string[], payload?: object);
	constructor(stringOrArray: string[] | object | string, payload?: object) {
		super(`User lacks role${Array.isArray(stringOrArray) ? "s" : ""}`, "lacksroles", {
			roles: Array.isArray(stringOrArray) ? stringOrArray : [ stringOrArray ],
			...payload
		});
		
	}
	
	name = "RolesError";
	
}
