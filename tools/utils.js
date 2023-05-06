// ./tools/utils.js
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function msToTime(duration) {
    const milliseconds = parseInt((duration % 1000));
    const seconds = parseInt((duration / 1000) % 60);
    const minutes = parseInt((duration / (1000 * 60)) % 60);
    const hours = parseInt((duration / (1000 * 60 * 60)) % 24);

    return `${hours}시간 ${minutes}분 ${seconds}초 ${milliseconds}ms`;
}

function convertToTimestamp(dateString) {
    const date = new Date(dateString);
    return date.getTime();
}

function removeDots(text) {
    if (text === undefined || text === null) {
        return '';
    }
    return text.trim().replace(/\./g, '');
}

function shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle
    while (0 !== currentIndex) {
        // Pick a remaining element
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

module.exports = {
    sleep,
    randomInRange,
    msToTime,
    convertToTimestamp,
    removeDots,
    shuffle
};