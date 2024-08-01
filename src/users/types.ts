export type UserDoc = {
	_id: string;
	email: string;
	password: string;
	roles: string[];
	name: {
		first?: string;
		middle?: string;
		last?: string;
	};
	org: null | string;
	job: string;
	avatar?: null | string;
	createdAt: number;
};
