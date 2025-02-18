import { Err } from "@nesvet/n";


export class AbilityError extends Err {
	constructor(payload?: object);
	constructor(longId: string, payload?: object);
	constructor(longId?: object | string, payload?: object) {
		if (typeof longId == "object") {
			payload = longId;
			longId = undefined;
		}
		
		super("User lacks ability", "lacksability", {
			...longId && { ability: longId },
			...payload
		});
		
	}
	
	name = "AbilityError";
	
}
