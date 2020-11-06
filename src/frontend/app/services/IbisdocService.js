export default class IbisdocService {

    constructor(ibisdocModel, codeView) {
        this.ibisdocModel = ibisdocModel;
        this.codeView = codeView;
    }

    getIbisdoc() {

        let cur = this;
        fetch('../rest/ibisdoc/ibisdoc.json', {
            method: 'GET'
        })
            .then(response => {
                return response.json()
            })
            .then(data => {
                cur.ibisdocModel.setIbisdoc(data);
            })
            .catch(err => {
                console.log("couldn't load ibisdoc, now switching to default ibisdoc", err);
                this.getDefaultIbisdoc();
            })

    }

    getDefaultIbisdoc() {
        let cur = this;
        fetch('https://cors-anywhere.herokuapp.com/https://ibis4example.ibissource.org/rest/ibisdoc/ibisdoc.json', {
            method: 'GET'
        })
            .then(response => {
                console.log(response)
                return response.json()
            })
            .then(data => {
                cur.ibisdocModel.setIbisdoc(data);
            })
            .catch(err => {
                alert("couldn't load pipe palette");
                console.log(err);

            })
    }
}