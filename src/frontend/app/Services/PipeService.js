export default class PipeService {

    constructor() {

    }

    getPipeWithActivity() {
        return fetch('./media/pipeWithActivity.json', {method: 'GET'}).then(response => {
            return response.json();
        })
        .then(data => {
            return data;
        })
        .catch(e => {
            console.error('Error getting pipe with activity: ' + e);
        })
    }
}
