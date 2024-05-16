export class Session {
	constructor(sessions, sessionDoc) {
		this.#sessions = sessions;
		
		this._id = sessionDoc._id;
		sessions.set(this._id, this);
		
		this.user = sessions.users.get(sessionDoc.user);
		this.user.sessions.add(this);
		
		sessions.users.bySessionId.set(this._id, this.user);
		
		this.update(sessionDoc);
		
	}
	
	#sessions;
	
	update({ _id, user, isOnline, ...restProps }) {
		
		const sessions = this.#sessions;
		
		if (isOnline !== undefined && this.isOnline !== isOnline) {
			this.isOnline = isOnline;
			
			if (sessions.isInited && this.user.isOnline !== this.isOnline)
				this.user.updateIsOnline();
		}
		
		Object.assign(this, restProps);
		
	}
	
	prolong({ _id, user, ...updates }) {
		
		const sessions = this.#sessions;
		
		const ts = Date.now();
		
		updates.prolongedAt = ts;
		updates.expiresAt = new Date(ts + (sessions.collection.expireAfterSeconds * 1000));
		
		this.update(updates);
		
		return sessions.collection.updateOne({ _id: this._id }, { $set: updates });
	}
	
	offline() {
		
		const updates = { isOnline: false };
		
		this.update(updates);
		
		return this.#sessions.collection.updateOne({ _id: this._id }, { $set: updates });
	}
	
	delete() {
		
		const sessions = this.#sessions;
		
		sessions.delete(this._id);
		this.user.sessions.delete(this);
		sessions.users.bySessionId.delete(this._id);
		
		sessions.users.emit("session-delete", this);
		
		if (this.isOnline)
			this.user.updateIsOnline();
		
	}
	
}
