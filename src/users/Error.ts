import { Err } from "@nesvet/n";


type Type = "_id" | "permissiveIds" | "slaveIds";


export class SubordinationError extends Err {
	constructor();
	constructor(type: Type, ids: string | string[]);
	constructor(type?: Type, ids?: string | string[]) {
		super("Insubordination attempt", "subordination", { type, ids: Array.isArray(ids) ? ids : [ ids ] });
		
	}
	
	name = "SubordinationError";
	
}
