export default class PipeService {

    constructor() {

    }

    getPipeWithActivity() {
        return fetch('./app/pipeWithActivity.json', {method: 'GET'}).then(response => {
            return response.json();
        })
        .then(data => {
            return data;
        })
        .catch(e => {
            console.log(e);
        })
    }
}