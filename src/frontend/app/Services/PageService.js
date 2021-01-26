export default class IbisdocService {
	constructor() {
		
	}

	getServerInfo() {
		const path = '/iaf/api/server/info';

		return fetch(path, {
			method: 'GET'
		})
		.then(response => response.json())
		.catch(e => {
			alert('Please check if your ibis started up correctly or if the property "configurations.directory" is set correctly')
			console.error('Error getting server info: ' + e);
		})
	}
}
