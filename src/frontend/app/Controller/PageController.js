import HeaderView from '../View/pageView/HeaderView.js';
import PageService from '../Services/PageService.js';
export default class PageController {

	constructor() {
		this.pageService = new PageService();
		this.setHeaderInfo();
	}

	setHeaderInfo() {
		this.pageService.getServerInfo().then(serverInfo => HeaderView.setFrankName(serverInfo.instance.name))
	}
}