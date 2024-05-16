export const regexps = {
	_id: /^[a-fA-F\d]{24}$/,
	email: /^[^\s@]{1,63}@[^\s@]{1,63}\.[^\s@]{1,63}$/,
	argon2: /^\$argon2(?:i|d|id)\$v=\d+\$m=\d+,t=\d+,p=\d+\$[a-zA-Z\d+/]+\$[a-zA-Z\d+/]+$/,
	sessionId: /^[a-fA-F\d]{16,32}\$[a-fA-F\d]{16,32}$/,
	role: /^[a-z\d\-_]{1,64}$/,
	ip: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
};

for (const key in regexps)
	if (Object.hasOwn(regexps, key))
		regexps[key].pattern = regexps[key].toString().slice(1, -1);
