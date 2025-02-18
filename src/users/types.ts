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
	org: string | null;
	job: string;
	avatar?: string | null;
	meta: Record<string, unknown>;
	createdAt: number;
};
