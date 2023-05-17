// categorizeDocumentsWithOpenAI.js
const { categorizeDataTask, createCompletion } = require('../lib/openaiHelper.js');
const { MongoClient } = require('mongodb');
const { sleep, randomInRange, msToTime, convertToTimestamp, removeDots, shuffle } = require('../tools/utils');
const { removeStopwords, eng, kor } = require('stopword');
const path = require('path');
const dotenv = require('dotenv');
const { exit } = require('process');
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

        //const documents = await collection.find({}, {
        const documents = await collection
            .find(
                {
                    $or: [
                        { Category1st: { $exists: false } },
                        { Category2nd: { $exists: false } },
                        { Category3rd: { $exists: false } },
                        { Category4th: { $exists: false } },
                        { Category5th: { $exists: false } }
                    ]
                },
                {
                    projection: {
                        _id: 1, dataId: 1, dataName: 1, dataTask: 1, dataTaskSlug: 1, useCaseText: 1, summary: 1, Category1st: 1, Category2nd: 1, Category3rd: 1, Category4th: 1, Category5th: 1, category: 1,
                        Category1stScore: 1, Category2ndScore: 1, Category3rdScore: 1, categorysl: 1 // 점수 필드 추가
                    }
                }
            ).toArray();
        console.log(`Found ${documents.length} documents to categorize.`);
        await asyncForEach(documents, async (doc, index, array) => {
            let { _id, dataId, dataName, dataTask, dataTaskSlug, useCaseText, summary, Category1st, Category1stScore, Category2nd, Category2ndScore, Category3rd, Category3rdScore, Category4th, Category5th, category, categorysl } = doc;
            //if (false) {
            if (category && category.split('.').length == 3 && Category1st.toLowerCase() == categorysl[0] && Category2nd.toLowerCase() == categorysl[1] && Category3rd.toLowerCase() == categorysl[2]
                && isValidCategory(Category1st) && isValidCategory(Category2nd) && isValidCategory(Category3rd) && isValidCategory(Category4th) && isValidCategory(Category5th)
                && Category1stScore > 10 && Category2ndScore > 10 && Category3rdScore > 10) {
                console.log(`[\x1b[33m${index + 1}\x1b[0m/${array.length}][\x1b[32mSKIPPED\x1b[0m][${dataId}] ${dataName} ${dataTask}\n[useCaseText] ${useCaseText}\n[Categories] ${category}\n[CategoryScores] ${Category1st}:${Category1stScore}, ${Category2nd}:${Category2ndScore}, ${Category3rd}:${Category3rdScore}\n`);
                //await sleep(1000); // 1초 딜레이를 추가합니다. 
            } else {
                const categoryScores = await categorizeDataTask(dataTask, useCaseText, summary);
                if (categoryScores == "Max attempts") {
                    console.log(`[\x1b[33m${index + 1}\x1b[0m/${array.length}][\x1b[31mERROR\x1b[0m][${dataId}] ${dataName} ${dataTask}\n`);
                    exit();
                }
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
