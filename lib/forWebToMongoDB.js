const url = require('url');
const { removeStopwords, eng, kor } = require('stopword');

function isValidUrl(string) {
    try {
        new url.URL(string);
        return true;
    } catch (e) {
        //console.error('Error in isValidUrl:', e);
        console.log('[Error][isValidUrl]', string);
        return false;
    }
}

function get_categorysl(Category1st, Category2nd, Category3rd) {
    return [
        Category1st.toLowerCase(),
        Category2nd.toLowerCase(),
        Category3rd.toLowerCase()
    ];
}

function get_search_keywords(dataName, dataTask, dataTaskSlug, summary, useCaseText, categorysl) {
    return [
        dataName.toLowerCase().trim(),
        dataTask.toLowerCase().trim(),
        dataTaskSlug.toLowerCase().trim(),
        summary.toLowerCase().trim(),
        useCaseText.toLowerCase().trim(),
        categorysl.join(' ').trim()
    ];
}

// 중복단어들을 제거한, 불용어들을 제외한 검색어 리턴, 영문,한글 지원, text index search에 사용예정
function get_search_keywords_filtered(search_keywords_filtered) {
    search_keywords_filtered = removeStopwords(search_keywords_filtered.split(' '), eng).join(' ');
    search_keywords_filtered = removeStopwords(search_keywords_filtered.split(' '), kor).join(' ');
    search_keywords_filtered = search_keywords_filtered.replace(/[.,;:]/g, ''); // Remove special characters
    search_keywords_filtered = search_keywords_filtered.replace(/[\n\r]/g, ' '); // Remove newline and carriage return characters
    search_keywords_filtered = search_keywords_filtered.replace(/<[^>]*>/g, ''); // Remove HTML tags
    search_keywords_filtered = [...new Set(search_keywords_filtered.split(' '))].join(' ');// Remove duplicates using Set
    return search_keywords_filtered;
}

module.exports = {
    isValidUrl,
    get_categorysl,
    get_search_keywords,
    get_search_keywords_filtered,
};