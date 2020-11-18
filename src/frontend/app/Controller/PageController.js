import HeaderView from '../View/pageView/HeaderView.js';

export default class PageController {

	constructor() {
		this.setHeaderInfo();
	}

	getServerInfo() {
		const path = '/iaf/api/server/info';

		return fetch(path, {
			method: 'GET'
		})
		.then(response => response.json())
		.catch(e => {
			alert('Please check if your ibis started up correctly or if the property Configurations.directory is set correctly')
			console.log('error getting server info: ' + e);
		})
	}

	setHeaderInfo() {
		this.getServerInfo().then(serverInfo => HeaderView.setFrankName(serverInfo.instance.name))
	}
}