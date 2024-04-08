export const basisTree = [
	{
		_id: "login",
		title: "Вход в систему",
		params: [
			{
				_id: "sessionsLimit",
				title: "Лимит активных сессий",
				type: "number",
				min: 1,
				max: 128
			},
			{
				_id: "sections",
				title: "Доступные разделы",
				type: "items",
				items: [
					{
						_id: "users",
						title: "Пользователи"
					}
				]
			}
		]
	}
];
