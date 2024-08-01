import type { Binary } from "insite-db";


export type AvatarDoc = {
	_id: string;
	type: string;
	size: number;
	ts: string;
	data: Binary;
};

export type AvatarsOptions = {
	//
};
