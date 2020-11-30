import HeaderView from '../View/pageView/HeaderView.js';
export default class PageController {

	constructor() {
		this.PageService = new PageService();
		this.setHeaderInfo();
	}

	setHeaderInfo() {
		PageService.getServerInfo().then(serverInfo => HeaderView.setFrankName(serverInfo.instance.name))
	}
}