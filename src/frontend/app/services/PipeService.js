export default class PipeService {

    constructor() {

    }

    getPipeWithActivity() {
        return fetch('./pipeWithActivity.json', {method: 'GET'}).then(response => {
            return response.json();
        })
        .then(data => {
            console.log(data);
            return data;
        })
        .catch(e => {
            console.log(e);
        })
    }
}