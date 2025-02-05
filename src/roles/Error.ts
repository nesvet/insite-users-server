import { Err } from "@nesvet/n";


export class RolesError extends Err {
	constructor(roleId: string);
	constructor(roleIds: string[]);
	constructor(stringOrArray: string | string[]) {
		super(`User lacks role${Array.isArray(stringOrArray) ? "s" : ""}`, "lacksroles", { roles: Array.isArray(stringOrArray) ? stringOrArray : [ stringOrArray ] });
		
	}
	
	name = "RolesError";
	
}
