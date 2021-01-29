export default class HeaderView { 

	static setFrankName(frankName){
		document.querySelector('#header-title h2').innerHTML = ' - ' + frankName;
	}
}