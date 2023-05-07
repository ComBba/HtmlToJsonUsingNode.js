function isCompletion(text) {
    //const regex = /^1: ?(Speeches|Images|Data Analysis|Videos|NLP|Chatbots|Frameworks|Education|Health|Financial Services|Logistics|Gaming|Human Resources|CRM|Contents Creation|Automation|Cybersecurity|Social Media|Environment|Smart Cities): ?[0-9]{1,3}(, (\d: ?(Speeches|Images|Data Analysis|Videos|NLP|Chatbots|Frameworks|Education|Health|Financial Services|Logistics|Gaming|Human Resources|CRM|Contents Creation|Automation|Cybersecurity|Social Media|Environment|Smart Cities): ?[0-9]{1,3})){4}$/;
    const regex = /^1: ?([A-Za-z ]+): ?[0-9]{1,3}(, (\d: ?([A-Za-z ]+): ?[0-9]{1,3})){4}$/;

    return regex.test(text);
}

//const testText = '1: Cybersecurity: 100, 2: Data Analysis: 90, 3: Automation: 80, 4: NLP: 70, 5: Chatbots: 60'; //true
//const testText = '1:Cybersecurity: 100, 2:Data Analysis: 90, 3:Automation: 80, 4:NLP: 70, 5:Chatbots: 60'; //true
//const testText = '1: Cybersecurity: 100, 2: Data Analysis: 90, 3: Automation: 80'; //false
//const testText = '1:Cybersecurity: 100, 2:Data Analysis: 90, 3:Automation: 80, 4:NLP: 70'; //false
const testText = '1:Cybersecurity: 100, 2:Data Analysis: 90, 3:Automation: 80, 4:NLP: 1, 5:Chatbots: 60'; //true
console.log(isCompletion(testText)); // true를 반환해야 합니다.