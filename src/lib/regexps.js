export const regexps = {
	_id: /^[\dA-Fa-f]{24}$/,
	email: /^[^\s@]{1,63}@[^\s@]{1,63}\.[^\s@]{1,63}$/,
	argon2: /^\$argon2(?:i|d|id)\$v=\d+\$m=\d+,t=\d+,p=\d+(?:\$[\d+/A-Za-z]+){2}$/,
	sessionId: /^[\dA-Fa-f]{16,32}\$[\dA-Fa-f]{16,32}$/,
	role: /^[\d_a-z-]{1,64}$/,
	ip: /^(?:\d{1,3}\.){3}\d{1,3}$/
};
