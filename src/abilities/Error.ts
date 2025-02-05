import { Err } from "@nesvet/n";


export class AbilityError extends Err {
	constructor(longId?: string) {
		super("User lacks ability", "lacksability", { ability: longId });
		
	}
	
	name = "AbilityError";
	
}
