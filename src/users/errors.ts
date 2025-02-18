import { Err } from "@nesvet/n";


export class UnauthorizedError extends Err {
	constructor(payload?: object) {
		super("Unauthorized", "unauthorized", payload);
		
	}
	
	name = "UnauthorizedError";
	
}


type SubordinationType = "_id" | "permissiveIds" | "slaveIds";

export class SubordinationError extends Err {
	constructor(payload?: object);
	constructor(type: SubordinationType, payload?: object);
	constructor(type: SubordinationType, ids: string[] | string, payload?: object);
	constructor(type?: SubordinationType | object, ids?: string[] | object | string, payload?: object) {
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
