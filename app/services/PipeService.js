export default class PipeService {

    constructor() {

    }

    getPipeWithActivity() {
        fetch('./app/pipeWithActivity.json', {method: 'GET'}).then(response => {
            return response.json();
        })
        .then(data => {
            console.log(data)
        })
        .catch(e => {
            console.log(e);
        })
    }
}