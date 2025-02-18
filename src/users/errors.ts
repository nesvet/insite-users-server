import { Err } from "@nesvet/n";


type Type = "_id" | "permissiveIds" | "slaveIds";


export class SubordinationError extends Err {
	constructor(payload?: object);
	constructor(type: Type, payload?: object);
	constructor(type: Type, ids: string[] | string, payload?: object);
	constructor(type?: Type | object, ids?: string[] | object | string, payload?: object) {
		switch (arguments.length) {
			case 1:
				payload = type as object;
				type = undefined;
				break;
			
			case 2:
				payload = ids as object;
				ids = undefined;
		}
		
		super("Insubordination attempt", "subordination", {
			...type && { type },
			...ids && { ids: Array.isArray(ids) ? ids : [ ids ] },
			...payload
		});
		
	}
	
	name = "SubordinationError";
	
}

export class PermissionError extends Err {
	constructor(payload?: object) {
		super("Insufficient permissions", "permissions", payload);
		
	}
	
	name = "PermissionError";
	
}

