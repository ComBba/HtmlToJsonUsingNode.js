// categorizeDocumentsWithOpenAI.js
const { createCompletion } = require('../lib/openaiHelper.js');
const { MongoClient } = require('mongodb');
const { sleep, randomInRange, msToTime, convertToTimestamp, removeDots, shuffle } = require('../tools/utils');
const { removeStopwords, eng, kor } = require('stopword');
const path = require('path');
const dotenv = require('dotenv');
const { res } = require('pino-std-serializers');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

function isValidCategory(category) {
    const validCategories = [
        'Speeches', 'Images', 'Data Analysis', 'Videos', 'NLP', 'Chatbots', 'Frameworks', 'Education', 'Health', 'Financial Services',
        'Logistics', 'Gaming', 'Human Resources', 'CRM', 'Contents Creation', 'Automation', 'Cybersecurity', 'Social Media',
        'Environment', 'Smart Cities'
    ];
    return validCategories.includes(category);
}

function isValidScore(score) {
    if (score == null || score == undefined || score == NaN)
        return false;
    return score >= 10 && score <= 100;
}

function isCompletion(text) {
    const regex = /^1: ?([A-Za-z ]+): ?[0-9]{1,3}(, (\d: ?([A-Za-z ]+): ?[0-9]{1,3})){4}$/;
    //const regex = /^1: ?(Speeches|Images|Data Analysis|Videos|NLP|Chatbots|Frameworks|Education|Health|Financial Services|Logistics|Gaming|Human Resources|CRM|Contents Creation|Automation|Cybersecurity|Social Media|Environment|Smart Cities): ?[0-9]{1,3}(, (\d: ?(Speeches|Images|Data Analysis|Videos|NLP|Chatbots|Frameworks|Education|Health|Financial Services|Logistics|Gaming|Human Resources|CRM|Contents Creation|Automation|Cybersecurity|Social Media|Environment|Smart Cities): ?[0-9]{1,3})){4}$/;

    return regex.test(text);
}

async function categorizeDataTask(dataTask, useCaseText, summary) {
    const systemContent = "You are a helpful assistant that categorizes data.";
    let excludedCategories = [];
    let isValid = false;
    let attemptCount = 0;
    let response;
    let categoryScores;
    let temperature = 0.4;
    while (!isValid) {
        if (temperature > 0.9 || temperature < 0.1) {
            temperature = 0.1;
            excludedCategories = [];
        }
        attemptCount += 1;
        //const userContent = `Please select the top 3 from the list below in order of highest relevance to the provided data Task, useCaseText, summary, and respond in the format of '1: {category_name_1: suitability score}, 2: {category_name_2: suitability score}, 3: {category_name_3: suitability score}'. Assign a suitability score from 0 to 100 for each category, with 100 being the most suitable and 0 being the least suitable.\n
        const userContent = `Absolutely select the top 5 from the list below in order of highest relevance to the provided data Task, useCaseText, summary, and Assign a suitability score from 0 to 100 for each category, with 100 being the most suitable and 0 being the least suitable. respond in the format of '1:{category_name_1:suitability score}, 2:{category_name_2:suitability score}, 3:{category_name_3:suitability score}, 4:{category_name_4:suitability score}, 5:{category_name_5:suitability score}'.\n
        A list of valid categories: 'Speeches', 'Images', 'Data Analysis', 'Videos', 'NLP', 'Chatbots', 'Frameworks', 'Education', 'Health', 'Financial Services', 'Logistics', 'Gaming', 'Human Resources', 'CRM', 'Contents Creation', 'Automation', 'Cybersecurity', 'Social Media', 'Environment', 'Smart Cities'\n"Excluded categories" are not valid categories and should never be included in a response.\n`;
        const inputText = `Task:${dataTask}\nuseCaseText:${useCaseText}\nsummary:${summary}\nCategories to be excluded:${excludedCategories.join(', ')}`;

        response = await createCompletion(inputText, systemContent, userContent, temperature);
        if (response && response.messageContent && response.messageContent.length > 10) {
            console.log('[messageContent]', response.messageContent);
            if (!isCompletion(response.messageContent)) {
                temperature += 0.1;
                console.log('[Attempt][\x1b[31mregex Fail\x1b[0m] count:', attemptCount, '\ntemperature:', temperature);
                sleep(3000);
                continue;
            }
            //1:Contents Creation:95, 2: Chatbots:90, 3: NLP:85
            //1:{category_name_1:suitability score}, 2:{category_name_2:suitability score}, 3:{category_name_3:suitability score}
            categoryScores = response.messageContent.split(', ').map(c => {
                //console.log('[c]', c);
                const [number, category, score] = c.split(':');
                //console.log('[number]', number, '[category]', category, '[score]', score);
                return { category: removeDots(category), score: parseFloat(score) };
            });
            console.log('[categoryScores]', categoryScores);
            isValid = categoryScores.every(item => isValidCategory(item.category));
            const isValidNumber = categoryScores.slice(0, 3).every(item => isValidScore(item.score));

            if (!isValid) {
                excludedCategories = excludedCategories.concat(
                    categoryScores
                        .filter(c => !isValidCategory(c.category) && c.category.length >= 2) // 길이가 2 이상인 경우에만 필터링합니다.
                        .map(c => c.category) // 각 요소에서 'category' 프로퍼티만 추출합니다.
                );
                console.log('[Attempt][Invalid] count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
                temperature += 0.1;
                sleep(3000);
            } else if (!isValidNumber) {
                isValid = false;
                console.log('[Attempt][InvalidNumber] count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
                temperature -= 0.1;
                sleep(3000);
            } else if (categoryScores.length != 5) {
                isValid = false;
                console.log('[Attempt][InvalidCategoryScoresCount] categoryScores.length:', categoryScores.length, '\n count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
                sleep(3000);
            } else {
                console.log('[Attempt][Success] count:', attemptCount);
            }
        } else {
            console.log('[OpenAI][ERROR] return response.messageContent is empty');
        }
    }
    return categoryScores;
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

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        //for (let index = 200; index < 1126; index++) {
        //for (let index = 1125; index < 2051; index++) {
        //for (let index = 2050; index < 2976; index++) {
        //for (let index = 2975; index < 3901; index++) {
        try {
            await callback(array[index], index, array);
        } catch (error) {
            console.error(`Error processing item at index ${index}:`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms 지연
    }
}

(async function main() {
    try {
        console.log('Categorizing data tasks started...');
        await client.connect();
        console.log('client.connect()...');
        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

        //const documents = await collection.find({ category: { $exists: false } }).toArray();
        const documents = await collection.find({}, {
            projection: {
                _id: 1, dataId: 1, dataName: 1, dataTask: 1, dataTaskSlug: 1, useCaseText: 1, summary: 1, Category1st: 1, Category2nd: 1, Category3rd: 1, Category4th: 1, Category5th: 1, category: 1,
                Category1stScore: 1, Category2ndScore: 1, Category3rdScore: 1, categorysl: 1 // 점수 필드 추가
            }
        }).toArray();
        console.log(`Found ${documents.length} documents to categorize.`);
        await asyncForEach(documents, async (doc, index, array) => {
            let { _id, dataId, dataName, dataTask, dataTaskSlug, useCaseText, summary, Category1st, Category1stScore, Category2nd, Category2ndScore, Category3rd, Category3rdScore, Category4th, Category5th, category, categorysl } = doc;
            //if (false) {
            if (category && category.split('.').length == 3 && Category1st.toLowerCase() == categorysl[0] && Category2nd.toLowerCase() == categorysl[1] && Category3rd.toLowerCase() == categorysl[2]
                && isValidCategory(Category1st) && isValidCategory(Category2nd) && isValidCategory(Category3rd) && isValidCategory(Category4th) && isValidCategory(Category5th)
                && Category1stScore > 10 && Category2ndScore > 10 && Category3rdScore > 10) {
                //console.log('[MongoDB][Category1st]', Category1st, ':', Category1stScore, ' / [Category2nd]', Category2nd, ':', Category2ndScore, ' / [Category3rd]', Category3rd, ':', Category3rdScore)
                //console.log('[MongoDB][categorysl]', categorysl);
                console.log(`[\x1b[33m${index + 1}\x1b[0m/${array.length}][\x1b[32mSKIPPED\x1b[0m][${dataId}] ${dataName} ${dataTask}\n[useCaseText] ${useCaseText}\n[Categories] ${category}\n[CategoryScores] ${Category1st}:${Category1stScore}, ${Category2nd}:${Category2ndScore}, ${Category3rd}:${Category3rdScore}\n`);
                //await sleep(1000); // 1초 딜레이를 추가합니다. 
            } else {
                /*
                const isCategoryLengthValid = category && category.split('.').length == 3;
                const areCategoryNamesValid = Category1st.toLowerCase() == categorysl[0] && Category2nd.toLowerCase() == categorysl[1] && Category3rd.toLowerCase() == categorysl[2];
                const areCategoriesValid = isValidCategory(Category1st) && isValidCategory(Category2nd) && isValidCategory(Category3rd) && isValidCategory(Category4th) && isValidCategory(Category5th);
                const areCategoryScoresValid = Category1stScore > 10 && Category2ndScore > 10 && Category3rdScore > 10;

                if (isCategoryLengthValid && areCategoryNamesValid && areCategoriesValid && areCategoryScoresValid) {
                    // ...
                } else {
                    console.log("isCategoryLengthValid:", isCategoryLengthValid);
                    console.log("areCategoryNamesValid:", areCategoryNamesValid);
                    console.log("areCategoriesValid:", areCategoriesValid);
                    console.log("areCategoryScoresValid:", areCategoryScoresValid);
                }
                */
                const categoryScores = await categorizeDataTask(dataTask, useCaseText, summary);
                if (categoryScores.length > 2) {
                    const category = categoryScores.slice(0, 3).map(item => item.category).join('.');
                    const [Category1st, Category2nd, Category3rd] = category.split('.');
                    const categorysl = get_categorysl(Category1st, Category2nd, Category3rd);
                    const search_keywords = get_search_keywords(dataName, dataTask, dataTaskSlug, summary, useCaseText, categorysl);
                    const search_keywordsl = search_keywords.join(' ');
                    const search_keywords_filtered = get_search_keywords_filtered(search_keywordsl);

                    await collection.updateOne(
                        { _id },
                        {
                            $set: {
                                category,
                                Category1st: categoryScores[0].category,
                                Category1stScore: categoryScores[0].score,
                                Category2nd: categoryScores[1].category,
                                Category2ndScore: categoryScores[1].score,
                                Category3rd: categoryScores[2].category,
                                Category3rdScore: categoryScores[2].score,
                                Category4th: categoryScores[3].category,
                                Category4thScore: categoryScores[3].score,
                                Category5th: categoryScores[4].category,
                                Category5thScore: categoryScores[4].score,
                                categorys: [
                                    Category1st,
                                    Category2nd,
                                    Category3rd
                                ],
                                categorysl: categorysl,
                                search_keywordsl: search_keywordsl,
                                search_keywords_filtered: search_keywords_filtered,
                            },
                        }
                    );
                    console.log(`[\x1b[33m${index + 1}\x1b[0m/${array.length}][\x1b[32mOK\x1b[0m][${dataId}] ${dataName} ${dataTask}\n[category] ${category}\n[useCaseText] ${useCaseText}\n\n`);
                } else {
                    console.log(`[${index + 1}/${array.length}][Fail][${dataId}] ${dataName} ${dataTask}\n[useCaseText] ${useCaseText}\n[category] ${category}`);
                }
                await sleep(5000); // 5초 딜레이를 추가합니다.
            }
        });
    } catch (error) {
        console.error('Error categorizing data tasks:', error);
    } finally {
        await client.close();
        console.log('Categorizing data tasks completed.');
    }
})();
