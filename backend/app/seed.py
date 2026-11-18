"""Seed the database with the MVP reference data and clearly marked demo content.

Usage:
    uv run python -m app.seed
    uv run python -m app.seed --reset   # destructive, development only

The scientific content is intentionally marked ``is_demo=True``. The customer
must replace it with validated methodological materials before real research.
"""

import argparse
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal
from app.demo_translations import (
    ALGORITHM_TRANSLATIONS_EN,
    ASSESSMENT_QUESTIONS_EN,
    LESSON_TRANSLATIONS_EN,
    PROJECT_RUBRIC_LABELS_EN,
    PROJECT_TRANSLATIONS_EN,
    TASK_RUBRIC_LABELS_EN,
    TASK_TRANSLATIONS_EN,
)
from app.models.assessment import (
    Assessment,
    AssessmentAnswer,
    AssessmentAttempt,
    AssessmentQuestion,
)
from app.models.classroom import (
    Assignment,
    Classroom,
    ClassroomMember,
    LessonProgress,
    Submission,
)
from app.models.content import (
    Algorithm,
    Competency,
    Lesson,
    LessonCompetency,
    Project,
    ProjectCompetency,
    Resource,
    Task,
    TaskCompetency,
    TaskOption,
)
from app.models.enums import ResourceKind
from app.models.user import User
from app.services.scoring import score_attempt
from app.services.text import sanitize_html

NOW = datetime.now(UTC)


def q(question_type: str, body: str, competency_slug: str, options: list[tuple[str, bool]]) -> dict:
    return {
        "type": question_type,
        "body": body,
        "competency": competency_slug,
        "options": [
            {
                "id": uuid.uuid4().hex,
                "label": label,
                "is_correct": correct,
                "order_no": index + 1,
            }
            for index, (label, correct) in enumerate(options)
        ],
    }


COMPETENCIES = [
    {
        "slug": "logic-algorithmic",
        "title": "Логикалық-алгоритмдік ойлау",
        "description": (
            "Демо-материал: есепті қадамдарға бөлу, алгоритмді жобалау және ML моделінің "
            "шешімін логикалық түрде түсіндіру қабілеті."
        ),
        "indicators": [
            "Есепті кіріс, өңдеу және шығыс қадамдарына бөледі.",
            "Модель шешімін себеп-салдар тізбегімен түсіндіреді.",
            "Қарапайым алгоритмді псевдокод түрінде жазады.",
        ],
        "criteria": {
            "low": "Қадамдарды атайды, бірақ реттілігін түсіндіру қиын.",
            "medium": "Алгоритмді дұрыс құрады, кейбір шешімдерді түсіндіреді.",
            "high": "Алгоритмді оңтайландырады және шешімді дәлелмен түсіндіреді.",
        },
    },
    {
        "slug": "data-literacy",
        "title": "Деректермен жұмыс",
        "description": (
            "Демо-материал: деректерді жинау, тазалау, белгілерді таңдау және "
            "олардың сапасын бағалау дағдысы."
        ),
        "indicators": [
            "Деректер көзін және өлшеу әдісін сипаттайды.",
            "Жетіспейтін мәндер мен қателерді табады.",
            "Оқыту және тест жиынтықтарын дұрыс бөледі.",
        ],
        "criteria": {
            "low": "Деректерді жинайды, бірақ сапасын тексере алмайды.",
            "medium": "Негізгі тазалау қадамдарын орындайды.",
            "high": "Деректер сапасын дәлелді критерийлермен бағалайды.",
        },
    },
    {
        "slug": "research-skills",
        "title": "Зерттеу дағдылары",
        "description": (
            "Демо-материал: болжам құру, эксперимент жоспарлау, нәтижені өлшеу "
            "және қорытындыны дәлелмен байланыстыру."
        ),
        "indicators": [
            "Тексерілетін болжам тұжырымдайды.",
            "Эксперимент шарттарын тұрақты ұстайды.",
            "Нәтижені болжаммен салыстырып, шектеулерді атайды.",
        ],
        "criteria": {
            "low": "Болжамды тұжырымдайды, бірақ оны тексеру жоспары жоқ.",
            "medium": "Эксперимент жүргізіп, нәтижені сипаттайды.",
            "high": "Қайталанатын эксперимент жоспарлап, қателік көздерін талдайды.",
        },
    },
    {
        "slug": "engineering-design",
        "title": "Инженерлік-жобалық ойлау",
        "description": (
            "Демо-материал: нақты мәселені шешу үшін прототип жасау, "
            "талаптарды ескеру және шешімді жақсарту."
        ),
        "indicators": [
            "Мәселені пайдаланушы қажеттілігіне айналдырады.",
            "Прототиптің ең қарапайым нұсқасын жасайды.",
            "Сынақ нәтижесі бойынша шешімді жақсартады.",
        ],
        "criteria": {
            "low": "Идеяны сипаттайды, прототип жоқ.",
            "medium": "Жұмыс істейтін қарапайым прототип жасайды.",
            "high": "Прототипті сынап, өлшенген жақсарту енгізеді.",
        },
    },
    {
        "slug": "creative-thinking",
        "title": "Шығармашылық ойлау",
        "description": (
            "Демо-материал: балама шешімдер ұсыну, идеяларды біріктіру және "
            "ML технологиясын жаңа контексте қолдану."
        ),
        "indicators": [
            "Кемінде үш балама шешім ұсынады.",
            "Идеяларды жаңа тәсілмен біріктіреді.",
            "Шешімнің пайдасы мен тәуекелін салыстырады.",
        ],
        "criteria": {
            "low": "Бір стандартты шешім ұсынады.",
            "medium": "Бірнеше баламаны салыстырады.",
            "high": "Түпнұсқа шешімді негіздеп, тәуекелдерін бағалайды.",
        },
    },
]

# English translations of the demonstration competencies; these remain demo material.
COMPETENCY_TRANSLATIONS_EN = {
    "logic-algorithmic": {"title": "Logical and algorithmic thinking", "description": "Demo: breaking a problem into steps, designing an algorithm, and explaining an ML model's decision logically.", "indicators_json": ["Breaks a problem into input, processing, and output steps.", "Explains a model's decision as a chain of cause and effect.", "Writes a simple algorithm in pseudocode."], "criteria_json": {"low": "Names steps but struggles to explain their order.", "medium": "Builds an algorithm correctly and explains some decisions.", "high": "Optimizes the algorithm and supports decisions with evidence."}},
    "data-literacy": {"title": "Working with data", "description": "Demo: collecting and cleaning data, selecting features, and evaluating data quality.", "indicators_json": ["Describes the data source and measurement method.", "Finds missing values and errors.", "Splits training and test sets correctly."], "criteria_json": {"low": "Collects data but cannot check its quality.", "medium": "Performs basic cleaning steps.", "high": "Evaluates data quality using justified criteria."}},
    "research-skills": {"title": "Research skills", "description": "Demo: forming a hypothesis, planning an experiment, measuring results, and linking conclusions to evidence.", "indicators_json": ["Formulates a testable hypothesis.", "Keeps experimental conditions consistent.", "Compares results with the hypothesis and identifies limitations."], "criteria_json": {"low": "States a hypothesis without a plan to test it.", "medium": "Conducts an experiment and describes the results.", "high": "Plans a repeatable experiment and analyzes sources of error."}},
    "engineering-design": {"title": "Engineering and design thinking", "description": "Demo: building a prototype to solve a real problem, considering requirements, and improving the solution.", "indicators_json": ["Translates a problem into user needs.", "Builds the simplest version of a prototype.", "Improves a solution based on test results."], "criteria_json": {"low": "Describes an idea without a prototype.", "medium": "Builds a simple working prototype.", "high": "Tests a prototype and makes a measurable improvement."}},
    "creative-thinking": {"title": "Creative thinking", "description": "Demo: proposing alternative solutions, combining ideas, and applying ML in a new context.", "indicators_json": ["Proposes at least three alternative solutions.", "Combines ideas in a new way.", "Compares the benefits and risks of a solution."], "criteria_json": {"low": "Proposes one standard solution.", "medium": "Compares several alternatives.", "high": "Justifies an original solution and evaluates its risks."}},
}

ALGORITHMS = [
    {
        "slug": "classification",
        "title": "Классификация",
        "title_en": "Classification",
        "summary": "Демо-материал: нысанды алдын ала белгілі сыныптардың біріне жатқызу.",
        "body": """
            <h2>Классификация деген не?</h2>
            <p>Классификация — нысанның белгілеріне қарап, оны алдын ала белгілі бір сыныпқа
            жатқызатын бақыланатын оқыту әдісі. Мысалы, суреттегі қоқысты «қағаз», «пластик»
            немесе «шыны» деп анықтау.</p>
            <h3>Негізгі қадамдар</h3>
            <ol>
              <li>Сыныптарды анықтау және мысалдар жинау.</li>
              <li>Деректерді оқыту және тест жиынтықтарына бөлу.</li>
              <li>Модельді оқыту (мысалы, Teachable Machine).</li>
              <li>Дәлдікті тест жиынтығында тексеру.</li>
              <li>Қателерді талдап, деректерді жақсарту.</li>
            </ol>
            <p>Практика: <a href="https://teachablemachine.withgoogle.com/" target="_blank"
            rel="noopener noreferrer">Teachable Machine</a> қызметінде суреттерді үш сыныпқа
            бөліп, модельді сынап көріңіз.</p>
            <blockquote>Бұл материал демонстрациялық. Нақты әдістемелік мәтінді тапсырыс беруші
            ғылыми негізде дайындайды.</blockquote>
        """,
        "competencies": ["logic-algorithmic", "data-literacy", "creative-thinking"],
    },
    {
        "slug": "linear-regression",
        "title": "Сызықтық регрессия",
        "title_en": "Linear Regression",
        "summary": "Демо-материал: сандық шаманы басқа шамаларға қарап болжау.",
        "body": """
            <h2>Сызықтық регрессия</h2>
            <p>Сызықтық регрессия кіріс белгілері мен шығыс мәні арасындағы сызықтық
            байланысты табады: <code>y = w₁x₁ + w₂x₂ + ... + b</code>.</p>
            <h3>Қолданылуы</h3>
            <ul>
              <li>Ауа райы температурасын болжау.</li>
              <li>Оқу уақыты мен балл арасындағы байланысты зерттеу.</li>
              <li>Үй бағасын болжау.</li>
            </ul>
            <p>Модель сапасы орташа квадраттық қате (MSE) және детерминация коэффициенті
            (R²) арқылы бағаланады. Деректерді <a href="https://colab.research.google.com/"
            target="_blank" rel="noopener noreferrer">Google Colab</a> ортасында талдауға болады.</p>
        """,
        "competencies": ["logic-algorithmic", "data-literacy", "research-skills"],
    },
    {
        "slug": "decision-tree",
        "title": "Шешім ағашы",
        "title_en": "Decision Tree",
        "summary": "Демо-материал: тізбектелген сұрақтар арқылы шешім қабылдау моделі.",
        "body": """
            <h2>Шешім ағашы қалай жұмыс істейді?</h2>
            <p>Шешім ағашы әр түйінде белгі бойынша сұрақ қояды және жауапқа қарай
            тармақтайды. Түбірден жапыраққа дейінгі жол — модельдің шешім ережесі.</p>
            <h3>Артықшылықтары</h3>
            <ul>
              <li>Шешімді адамға түсінікті түрде көрсетеді.</li>
              <li>Санаттық және сандық белгілермен жұмыс істей алады.</li>
              <li>Медицина, білім және қаржы салаларында шешім қолдау үшін қолданылады.</li>
            </ul>
            <p>Негізгі тәуекел — ағаштың тым терең болып, оқыту деректерін жаттап алуы
            (overfitting). Оны тереңдікті шектеу және кросс-валидация арқылы азайтады.</p>
        """,
        "competencies": ["logic-algorithmic", "research-skills", "engineering-design"],
    },
]

LESSONS = [
    {
        "slug": "ml-introduction",
        "order_no": 1,
        "title": "Машиналық оқытуға кіріспе",
        "algorithm": "classification",
        "summary": "Демо-сабақ: ML түрлері, оқыту деректері және STEM байланысы.",
        "goal": "Машиналық оқытудың негізгі түрлерін ажыратып, күнделікті мысалдармен түсіндіру.",
        "duration_min": 45,
        "competencies": ["logic-algorithmic", "data-literacy"],
        "body": """
            <h2>Машиналық оқыту деген не?</h2>
            <p>Машиналық оқыту — компьютерге нақты ережелерді жазбай-ақ, деректерден
            заңдылықты табуға мүмкіндік беретін әдістер жиынтығы.</p>
            <h3>Негізгі түрлері</h3>
            <ul>
              <li><strong>Бақыланатын оқыту:</strong> дұрыс жауабы бар деректермен оқыту.</li>
              <li><strong>Бақыланбайтын оқыту:</strong> жасырын құрылымдарды табу.</li>
              <li><strong>Күшейту арқылы оқыту:</strong> сынақ пен марапат арқылы әрекетті жақсарту.</li>
            </ul>
            <p>Бұл сабақта біз классификация мысалын қарастырамыз: суретті сыныпқа жатқызу.</p>
        """,
        "reflection": "Қандай күнделікті технологиялар ML қолданады? Бір мысал жазыңыз.",
    },
    {
        "slug": "data-collection-cleaning",
        "order_no": 2,
        "title": "Деректерді жинау және тазалау",
        "algorithm": "classification",
        "summary": "Демо-сабақ: деректер көздері, сапа критерийлері және тазалау практикасы.",
        "goal": "Деректер жиынтығының сапасын бағалап, негізгі тазалау қадамдарын орындау.",
        "duration_min": 45,
        "competencies": ["data-literacy", "research-skills"],
        "body": """
            <h2>Деректер — модельдің отыны</h2>
            <p>Модельдің сапасы көбіне деректердің сапасына тәуелді. Деректер жинау кезінде
            өлшеу әдісін, өкілдікті және рұқсаттарды ескеру керек.</p>
            <h3>Тазалау тексер-парақшасы</h3>
            <ul>
              <li>Жетіспейтін мәндерді анықтау және негіздеу.</li>
              <li>Дубликаттарды жою.</li>
              <li>Өлшем бірліктерін бір форматқа келтіру.</li>
              <li>Сыныптар теңгерімін тексеру.</li>
              <li>Жеке деректерді алып тастау немесе анонимдеу.</li>
            </ul>
            <p><a href="https://www.kaggle.com/datasets" target="_blank" rel="noopener noreferrer">Kaggle</a>
            сияқты ашық деректер қорларынан кішкене жиынтық таңдап, осы тексер-парақшаны қолданыңыз.</p>
        """,
        "reflection": "Деректерде қандай қате көздері болуы мүмкін? Екі мысал келтіріңіз.",
    },
    {
        "slug": "teachable-machine-practice",
        "order_no": 3,
        "title": "Classification: Teachable Machine практикумы",
        "algorithm": "classification",
        "summary": "Демо-сабақ: сурет классификаторын жасау және дәлдігін тексеру.",
        "goal": "Teachable Machine көмегімен сурет классификаторын құру және нәтижесін бағалау.",
        "duration_min": 90,
        "competencies": ["logic-algorithmic", "engineering-design", "creative-thinking"],
        "body": """
            <h2>Практикум қадамдары</h2>
            <ol>
              <li><a href="https://teachablemachine.withgoogle.com/train/image" target="_blank"
              rel="noopener noreferrer">Teachable Machine</a> ашып, Image Project таңдаңыз.</li>
              <li>Үш сынып құрыңыз, әрқайсысына кемінде 30 сурет жүктеңіз.</li>
              <li>Модельді оқытып, Preview терезесінде сынақ жүргізіңіз.</li>
              <li>Қате жауаптарды жазып, деректерді жақсартыңыз.</li>
              <li>Нәтижені CSV кестесіне тіркеп, сыныптастарыңызбен талқылаңыз.</li>
            </ol>
            <h3>Бағалау критерийлері</h3>
            <ul>
              <li>Деректер жиынтығының сипаттамасы бар.</li>
              <li>Сынақ нәтижелері сандық түрде көрсетілген.</li>
              <li>Қателерге негізделген жақсарту ұсынылған.</li>
            </ul>
        """,
        "reflection": "Модель қандай жағдайда қателесті? Деректерді қалай жақсарта аласыз?",
    },
    {
        "slug": "linear-regression-model",
        "order_no": 4,
        "title": "Linear Regression: болжау моделі",
        "algorithm": "linear-regression",
        "summary": "Демо-сабақ: регрессия теңдеуі, MAE/MSE және R² көрсеткіштері.",
        "goal": "Сызықтық регрессия моделін құрып, болжам қатесін өлшеу.",
        "duration_min": 90,
        "competencies": ["logic-algorithmic", "data-literacy"],
        "body": """
            <h2>Модельдің математикалық негізі</h2>
            <p>Бір белгі үшін модель: <code>ŷ = w·x + b</code>. Оқыту кезінде w және b
            мәндері қателікті азайтатындай таңдалады.</p>
            <h3>Практика</h3>
            <p>Colab-та кішкене деректер жиынтығын жүктеп, <code>scikit-learn</code> кітапханасымен
            модель құрыңыз. MAE, MSE және R² көрсеткіштерін есептеңіз.</p>
            <pre><code>from sklearn.linear_model import LinearRegression
model = LinearRegression()
model.fit(X_train, y_train)
print(model.coef_, model.intercept_)</code></pre>
            <p>Деректерді оқыту (80%) және тест (20%) бөліктеріне бөліп, тесттегі нәтижені
            бағалауды ұмытпаңыз.</p>
        """,
        "reflection": "R² жоғары болса, модель әрқашан пайдалы ма? Неге?",
    },
    {
        "slug": "decision-tree-model",
        "order_no": 5,
        "title": "Decision Tree: шешім қабылдау",
        "algorithm": "decision-tree",
        "summary": "Демо-сабақ: шешім ағашын құру, тереңдікті реттеу және түсіндіру.",
        "goal": "Шешім ағашын құрып, оның шешім ережелерін адамға түсінікті түрде түсіндіру.",
        "duration_min": 90,
        "competencies": ["logic-algorithmic", "research-skills"],
        "body": """
            <h2>Ағашты құру</h2>
            <p>Scikit-learn-та <code>DecisionTreeClassifier</code> қолданыңыз. Ағаш тереңдігін
            шектеу арқылы overfitting-ті азайтуға болады.</p>
            <pre><code>from sklearn.tree import DecisionTreeClassifier, export_text
tree = DecisionTreeClassifier(max_depth=3, random_state=42)
tree.fit(X_train, y_train)
print(export_text(tree, feature_names=features))</code></pre>
            <h3>Зерттеу сұрағы</h3>
            <p>Ағаш тереңдігі 2, 3 және 5 болғанда тест дәлдігі қалай өзгереді?
            Нәтижені кестеге түсіріп, қорытынды жасаңыз.</p>
        """,
        "reflection": "Терең ағаш неге оқыту деректерін «жаттап алады»? Түсіндіріңіз.",
    },
    {
        "slug": "stem-project-planning",
        "order_no": 6,
        "title": "STEM жобасын жоспарлау және қорғау",
        "algorithm": "decision-tree",
        "summary": "Демо-сабақ: мәселеден прототипке дейінгі жоба жоспары және презентация.",
        "goal": "STEM жобасының жоспарын құрып, нәтижесін дәлелді түрде қорғау.",
        "duration_min": 45,
        "competencies": ["engineering-design", "creative-thinking", "research-skills"],
        "body": """
            <h2>Жоба жоспарының құрылымы</h2>
            <ol>
              <li><strong>Мәселе:</strong> кімге, қандай қиындық бар?</li>
              <li><strong>Мақсат:</strong> қандай өлшенетін нәтиже керек?</li>
              <li><strong>Болжам:</strong> қандай шешім көмектеседі деп ойлайсыз?</li>
              <li><strong>Прототип:</strong> ең қарапайым жұмыс нұсқасы.</li>
              <li><strong>Сынақ:</strong> нәтижені қалай өлшейсіз?</li>
              <li><strong>Қорытынды:</strong> нені үйрендіңіз, келесі қадам қандай?</li>
            </ol>
            <p>Презентацияда тек нәтижені емес, шешім қабылдау жолын да көрсетіңіз.</p>
        """,
        "reflection": "Жобаңыздың ең әлсіз бөлігі қайсы? Оны қалай тексересіз?",
    },
]

TASKS = [
    {
        "slug": "classification-definition",
        "lesson": "ml-introduction",
        "algorithm": "classification",
        "title": "Классификацияның мақсаты",
        "type": "single_choice",
        "difficulty": "easy",
        "instructions": "Дұрыс анықтаманы таңдаңыз.",
        "competencies": ["logic-algorithmic"],
        "max_score": 10,
        "options": [
            ("Нысанды алдын ала белгілі сыныпқа жатқызу", True),
            ("Деректерді кездейсоқ ретпен сақтау", False),
            ("Модельді оқытпай қолдану", False),
            ("Барлық белгілерді жою", False),
        ],
    },
    {
        "slug": "supervised-examples",
        "lesson": "ml-introduction",
        "algorithm": "classification",
        "title": "Бақыланатын оқыту мысалдары",
        "type": "multiple_choice",
        "difficulty": "medium",
        "instructions": "Бақыланатын оқытуға жататын тапсырмаларды таңдаңыз (бірнеше жауап).",
        "competencies": ["logic-algorithmic", "data-literacy"],
        "max_score": 15,
        "options": [
            ("Суреттегі нысанды сыныптау", True),
            ("Үй бағасын болжау", True),
            ("Деректерді кластерлеу", False),
            ("Мәтінді тақырып бойынша жіктеу", True),
        ],
    },
    {
        "slug": "ml-types-quiz",
        "lesson": "ml-introduction",
        "algorithm": "classification",
        "title": "ML түрлері",
        "type": "single_choice",
        "difficulty": "easy",
        "instructions": "Жасырын құрылымды табатын оқыту түрін таңдаңыз.",
        "competencies": ["logic-algorithmic"],
        "max_score": 10,
        "options": [
            ("Бақыланбайтын оқыту", True),
            ("Бақыланатын оқыту", False),
            ("Күшейту арқылы оқыту", False),
            ("Ешбірі дұрыс емес", False),
        ],
    },
    {
        "slug": "data-quality-checklist",
        "lesson": "data-collection-cleaning",
        "title": "Деректер сапасының тексер-парақшасы",
        "type": "open_text",
        "difficulty": "medium",
        "instructions": "Деректер жиынтығын тексеруге арналған 5 тармақтан тұратын парақша жазыңыз.",
        "competencies": ["data-literacy", "research-skills"],
        "max_score": 20,
        "rubric": [
            {"criterion": "Бес нақты тексеру қадамы", "points": 10},
            {"criterion": "Әр қадамның негіздемесі", "points": 10},
        ],
    },
    {
        "slug": "clean-csv-practice",
        "lesson": "data-collection-cleaning",
        "title": "Тазаланған CSV файлын жүктеу",
        "type": "file_upload",
        "difficulty": "medium",
        "instructions": "Таңдалған деректер жиынтығын тазалап, CSV файлын жүктеңіз. Не істегеніңізді сипаттаңыз.",
        "competencies": ["data-literacy"],
        "max_score": 20,
        "rubric": [
            {"criterion": "Файл ашылады және құрылымы дұрыс", "points": 5},
            {"criterion": "Жетіспейтін мәндер өңделген", "points": 5},
            {"criterion": "Дубликаттар жойылған", "points": 5},
            {"criterion": "Өзгерістер түсіндірілген", "points": 5},
        ],
    },
    {
        "slug": "colab-data-analysis",
        "lesson": "data-collection-cleaning",
        "title": "Colab деректер талдауы",
        "type": "link",
        "difficulty": "hard",
        "instructions": "Colab notebook сілтемесін жіберіңіз. Notebook ашық режимде болуы керек.",
        "competencies": ["data-literacy", "research-skills"],
        "max_score": 25,
        "rubric": [
            {"criterion": "Notebook ашылады", "points": 5},
            {"criterion": "Деректер жүктелген", "points": 5},
            {"criterion": "Кемінде үш талдау қадамы", "points": 10},
            {"criterion": "Қорытынды бар", "points": 5},
        ],
    },
    {
        "slug": "teachable-workflow",
        "lesson": "teachable-machine-practice",
        "algorithm": "classification",
        "title": "Teachable Machine жұмыс реті",
        "type": "multiple_choice",
        "difficulty": "medium",
        "instructions": "Модельді құрудың дұрыс қадамдарын таңдаңыз.",
        "competencies": ["logic-algorithmic", "engineering-design"],
        "max_score": 15,
        "options": [
            ("Сыныптар мен мысалдарды дайындау", True),
            ("Модельді оқыту", True),
            ("Тест жиынтығында тексеру", True),
            ("Тест деректерін оқытуға қосу", False),
        ],
    },
    {
        "slug": "classification-metrics",
        "lesson": "teachable-machine-practice",
        "title": "Классификация көрсеткіштері",
        "type": "single_choice",
        "difficulty": "medium",
        "instructions": "Дұрыс болжамдардың жалпы болжамдарға қатынасы қалай аталады?",
        "competencies": ["data-literacy"],
        "max_score": 10,
        "options": [
            ("Accuracy (дәлдік)", True),
            ("Learning rate", False),
            ("Batch size", False),
            ("Epoch", False),
        ],
    },
    {
        "slug": "teachable-model-link",
        "lesson": "teachable-machine-practice",
        "title": "Teachable Machine моделінің сілтемесі",
        "type": "link",
        "difficulty": "medium",
        "instructions": "Жасаған моделіңіздің ашық сілтемесін жіберіңіз.",
        "competencies": ["engineering-design", "creative-thinking"],
        "max_score": 20,
        "rubric": [
            {"criterion": "Сілтеме ашылады", "points": 5},
            {"criterion": "Кемінде үш сынып бар", "points": 5},
            {"criterion": "Модель сынақтан өткен", "points": 10},
        ],
    },
    {
        "slug": "linear-equation",
        "lesson": "linear-regression-model",
        "algorithm": "linear-regression",
        "title": "Регрессия теңдеуі",
        "type": "single_choice",
        "difficulty": "easy",
        "instructions": "Бір белгілі сызықтық регрессияның теңдеуін таңдаңыз.",
        "competencies": ["logic-algorithmic"],
        "max_score": 10,
        "options": [
            ("ŷ = w·x + b", True),
            ("ŷ = x² + b", False),
            ("ŷ = sin(x)", False),
            ("ŷ = 1/x", False),
        ],
    },
    {
        "slug": "regression-assumptions",
        "lesson": "linear-regression-model",
        "title": "Сызықтық регрессия шарттары",
        "type": "multiple_choice",
        "difficulty": "hard",
        "instructions": "Модельді бағалау кезінде ескерілетін шарттарды таңдаңыз.",
        "competencies": ["research-skills", "data-literacy"],
        "max_score": 20,
        "options": [
            ("Қалдықтарды талдау", True),
            ("Оқыту/тест бөлімінің болуы", True),
            ("Барлық деректерді оқытуға қалдыру", False),
            ("Белгілер арасындағы мультиколлинеарлықты тексеру", True),
        ],
    },
    {
        "slug": "colab-regression",
        "lesson": "linear-regression-model",
        "title": "Colab регрессия жобасы",
        "type": "link",
        "difficulty": "hard",
        "instructions": "Регрессия моделі бар Colab сілтемесін жіберіңіз. MAE, MSE және R² болуы керек.",
        "competencies": ["data-literacy", "research-skills"],
        "max_score": 25,
        "rubric": [
            {"criterion": "Notebook ашылады", "points": 5},
            {"criterion": "Модель оқытылған", "points": 10},
            {"criterion": "Үш көрсеткіш есептелген", "points": 5},
            {"criterion": "Қорытынды бар", "points": 5},
        ],
    },
    {
        "slug": "decision-tree-criterion",
        "lesson": "decision-tree-model",
        "algorithm": "decision-tree",
        "title": "Ағаш тармақтануы",
        "type": "single_choice",
        "difficulty": "medium",
        "instructions": "Шешім ағашында әр түйін нені білдіреді?",
        "competencies": ["logic-algorithmic"],
        "max_score": 10,
        "options": [
            ("Белгі бойынша қойылатын сұрақ/шарт", True),
            ("Деректер қорының кілті", False),
            ("Нейрон салмағы", False),
            ("Оқыту жылдамдығы", False),
        ],
    },
    {
        "slug": "overfitting-signs",
        "lesson": "decision-tree-model",
        "title": "Overfitting белгілері",
        "type": "multiple_choice",
        "difficulty": "hard",
        "instructions": "Overfitting белгілерін таңдаңыз.",
        "competencies": ["research-skills", "logic-algorithmic"],
        "max_score": 20,
        "options": [
            ("Оқыту деректерінде дәлдік жоғары, тестте төмен", True),
            ("Ағаш тым терең және күрделі", True),
            ("Тест дәлдігі оқытумен бірдей жоғары", False),
            ("Шу мен жеке ерекшеліктер жатталады", True),
        ],
    },
    {
        "slug": "tree-explanation",
        "lesson": "decision-tree-model",
        "title": "Мектеп мәселесіне шешім ағашы",
        "type": "open_text",
        "difficulty": "hard",
        "instructions": "Мектептегі бір мәселені таңдап, оны шешуге арналған 5 түйінді шешім ағашын мәтінмен сипаттаңыз.",
        "competencies": ["engineering-design", "creative-thinking"],
        "max_score": 25,
        "rubric": [
            {"criterion": "Мәселе нақты сипатталған", "points": 5},
            {"criterion": "Бес түйін дұрыс құрылған", "points": 10},
            {"criterion": "Шешімдер негізделген", "points": 10},
        ],
    },
    {
        "slug": "project-hypothesis",
        "lesson": "stem-project-planning",
        "title": "STEM жобасының болжамы",
        "type": "single_choice",
        "difficulty": "medium",
        "instructions": "Тексерілетін болжамның дұрыс тұжырымын таңдаңыз.",
        "competencies": ["research-skills"],
        "max_score": 10,
        "options": [
            ("Егер оқушылар күнде 20 минут практика жасаса, тест нәтижесі артады деп күтемін", True),
            ("Барлық оқушылар жақсы оқиды", False),
            ("ML өте қиын", False),
            ("Жоба қызықты болады", False),
        ],
    },
    {
        "slug": "project-prototype-link",
        "lesson": "stem-project-planning",
        "title": "Жоба прототипінің сілтемесі",
        "type": "link",
        "difficulty": "hard",
        "instructions": "Жоба прототипінің (Colab, Teachable Machine немесе басқа HTTPS) сілтемесін жіберіңіз.",
        "competencies": ["engineering-design", "creative-thinking"],
        "max_score": 30,
        "rubric": [
            {"criterion": "Сілтеме ашылады", "points": 5},
            {"criterion": "Прототип мәселені шешуге бағытталған", "points": 10},
            {"criterion": "Сынақ нәтижесі көрсетілген", "points": 10},
            {"criterion": "Келесі қадамдар сипатталған", "points": 5},
        ],
    },
    {
        "slug": "project-presentation",
        "lesson": "stem-project-planning",
        "title": "Жоба презентациясын жүктеу",
        "type": "file_upload",
        "difficulty": "medium",
        "instructions": "Жоба презентациясын PDF немесе PPTX форматында жүктеңіз.",
        "competencies": ["engineering-design", "creative-thinking"],
        "max_score": 30,
        "rubric": [
            {"criterion": "Мәселе мен мақсат нақты", "points": 5},
            {"criterion": "Әдістеме сипатталған", "points": 10},
            {"criterion": "Нәтиже мен қорытынды бар", "points": 10},
            {"criterion": "Презентация сапасы", "points": 5},
        ],
    },
]

PROJECTS = [
    {
        "slug": "image-classification",
        "title": "Кескіндерді классификациялау",
        "algorithm": "classification",
        "summary": "Демо-жоба: мектептегі қоқысты сұрыптауға арналған сурет классификаторы.",
        "problem": "Мектепте қоқыс дұрыс сұрыпталмайды, пластик пен қағаз араласып кетеді.",
        "goal": "Қоқыс түрін камера арқылы анықтайтын прототип жасау.",
        "competencies": ["logic-algorithmic", "engineering-design", "creative-thinking"],
        "tools": ["Teachable Machine", "Телефон камерасы", "Браузер"],
        "materials": ["Үш санатқа бөлінген 90+ сурет", "Сынақ журналы", "Презентация үлгісі"],
        "steps": [
            "Мәселені және пайдаланушыны анықтау.",
            "Үш сынып бойынша сурет жинау және рұқсаттарды тексеру.",
            "Teachable Machine-да модельді оқыту.",
            "Сынақ жүргізіп, дәлдікті өлшеу.",
            "Қателерді талдап, деректерді кеңейту.",
            "Прототипті қорғау және келесі қадамды ұсыну.",
        ],
        "expected": "Модель үш санатты кемінде 80% дәлдікпен ажыратады және шешімін түсіндіреді.",
        "rubric": [
            {"criterion": "Мәселе мен мақсат", "points": 15},
            {"criterion": "Деректер жиынтығы және этика", "points": 20},
            {"criterion": "Модель дәлдігі", "points": 25},
            {"criterion": "Талдау және жақсарту", "points": 25},
            {"criterion": "Презентация", "points": 15},
        ],
    },
    {
        "slug": "weather-forecast",
        "title": "Ауа райын болжау",
        "algorithm": "linear-regression",
        "summary": "Демо-жоба: тарихи деректер бойынша температураны болжайтын регрессия.",
        "problem": "Ауыл шаруашылығы үшін қысқа мерзімді температура болжамы қажет.",
        "goal": "Кемінде үш метеорологиялық белгіні қолданып, температураны болжайтын модель құру.",
        "competencies": ["data-literacy", "research-skills", "logic-algorithmic"],
        "tools": ["Google Colab", "Python", "pandas", "scikit-learn"],
        "materials": ["Ашық метеорологиялық деректер", "Notebook үлгісі", "Бағалау кестесі"],
        "steps": [
            "Деректер көзін таңдау және рұқсатты тексеру.",
            "Деректерді тазалау және белгілерді таңдау.",
            "Оқыту/тест жиынтықтарын бөлу.",
            "Сызықтық регрессия моделін оқыту.",
            "MAE, MSE және R² есептеу.",
            "Шектеулерді сипаттап, нәтижені қорғау.",
        ],
        "expected": "Модель тест жиынтығында өлшенген қателікпен болжам жасайды және шектеулері сипатталады.",
        "rubric": [
            {"criterion": "Деректер сапасы", "points": 20},
            {"criterion": "Модель құру", "points": 25},
            {"criterion": "Өлшенген нәтиже", "points": 25},
            {"criterion": "Зерттеу қорытындысы", "points": 20},
            {"criterion": "Презентация", "points": 10},
        ],
    },
    {
        "slug": "school-decision-support",
        "title": "Мектептегі шешім қабылдау жүйесі",
        "algorithm": "decision-tree",
        "summary": "Демо-жоба: оқушыға қосымша қолдау қажет пе екенін анықтайтын шешім ағашы.",
        "problem": "Мұғалімге оқушының оқу қиындықтарын ерте анықтау қиын.",
        "goal": "Қауіпсіз және түсінікті шешім ағашы негізінде қолдау ұсынысын құру.",
        "competencies": ["engineering-design", "research-skills", "logic-algorithmic"],
        "tools": ["Python", "scikit-learn", "Google Colab"],
        "materials": ["Анонимделген оқу көрсеткіштері", "Этикалық тексеру парағы", "Презентация"],
        "steps": [
            "Мәселені және шешім қабылдаушыны анықтау.",
            "Анонимделген деректер жиынтығын дайындау.",
            "Шешім ағашын құру және тереңдікті реттеу.",
            "Модель ережелерін мұғалімге түсіндіру.",
            "Әділдік пен жеке деректер тәуекелдерін талдау.",
            "Нәтижені пилоттық топта сынау.",
        ],
        "expected": "Ағаш шешімдері түсінікті, деректер анонимделген және шешім қолдау ретінде ұсынылады.",
        "rubric": [
            {"criterion": "Мәселені түсіну", "points": 15},
            {"criterion": "Деректер этикасы", "points": 20},
            {"criterion": "Модель және түсіндіру", "points": 25},
            {"criterion": "Сынақ және қорытынды", "points": 25},
            {"criterion": "Қорғау", "points": 15},
        ],
    },
    {
        "slug": "author-ml-project",
        "title": "Авторлық ML-жоба",
        "algorithm": "classification",
        "summary": "Демо-жоба: оқушының өз мәселесіне арналған ML шешімі.",
        "problem": "Оқушы өз қауымдастығындағы нақты мәселені таңдайды.",
        "goal": "ML элементі бар прототип жасап, нәтижесін дәлелді түрде ұсыну.",
        "competencies": ["creative-thinking", "engineering-design", "research-skills", "data-literacy"],
        "tools": ["Таңдауы бойынша: Colab, Teachable Machine, Scikit-learn"],
        "materials": ["Зерттеу жоспары", "Деректер немесе бақылау журналы", "Презентация"],
        "steps": [
            "Мәселені зерттеп, болжам тұжырымдау.",
            "Шешім түрін таңдау және негіздеу.",
            "Деректерді жинау және өңдеу.",
            "Прототип құру.",
            "Нәтижені өлшеу және жақсарту.",
            "Жобаны қорғау.",
        ],
        "expected": "Жоба мәселені шешуге бағытталған, өлшенетін нәтижесі және этикалық талдауы бар.",
        "rubric": [
            {"criterion": "Мәселе және болжам", "points": 15},
            {"criterion": "Техникалық шешім", "points": 30},
            {"criterion": "Нәтижелерді өлшеу", "points": 25},
            {"criterion": "Этика және қауіпсіздік", "points": 15},
            {"criterion": "Презентация және рефлексия", "points": 15},
        ],
    },
]


def pre_questions() -> list[dict]:
    return [
        q("single_choice", "Классификация моделі нені болжайды?", "logic-algorithmic", [
            ("Нысанның сыныбын", True),
            ("Деректер қорының көлемін", False),
            ("Сервер жылдамдығын", False),
            ("Файл өлшемін", False),
        ]),
        q("multiple_choice", "Бақыланатын оқыту тапсырмаларын таңдаңыз.", "logic-algorithmic", [
            ("Суретті жіктеу", True),
            ("Бағаны болжау", True),
            ("Деректерді топтау", False),
            ("Мәтінді жіктеу", True),
        ]),
        q("single_choice", "Деректерді тазалаудың бірінші мақсаты қандай?", "data-literacy", [
            ("Қателер мен жетіспейтін мәндерді анықтау", True),
            ("Модельді бірден жариялау", False),
            ("Барлық бағандарды жою", False),
            ("Деректерді көбейту", False),
        ]),
        q("multiple_choice", "Деректер сапасының белгілерін таңдаңыз.", "data-literacy", [
            ("Толықтық", True),
            ("Дәлдік", True),
            ("Кездейсоқтық", False),
            ("Өзектілік", True),
        ]),
        q("single_choice", "Зерттеу болжамы қандай болуы керек?", "research-skills", [
            ("Тексеруге болатындай нақты", True),
            ("Дәлелсіз жалпы", False),
            ("Тек эмоцияға негізделген", False),
            ("Жасырын және белгісіз", False),
        ]),
        q("multiple_choice", "Экспериментті қайталауға не көмектеседі?", "research-skills", [
            ("Әдістемені нақты сипаттау", True),
            ("Деректерді сақтау", True),
            ("Нәтижені іріктеп көрсету", False),
            ("Бастапқы шарттарды тіркеу", True),
        ]),
        q("single_choice", "STEM жобасын жоспарлау қай қадамнан басталады?", "engineering-design", [
            ("Мәселені анықтау", True),
            ("Презентация жасау", False),
            ("Модельді жариялау", False),
            ("Баға қою", False),
        ]),
        q("multiple_choice", "Прототиптің MVP талаптарын таңдаңыз.", "engineering-design", [
            ("Негізгі мәселені шешеді", True),
            ("Сынаққа жарамды", True),
            ("Барлық функциясы дайын", False),
            ("Шектеулері белгілі", True),
        ]),
        q("single_choice", "Шығармашылық кезеңде идея генерациясының дұрыс ережесі қандай?", "creative-thinking", [
            ("Идеяларды алдымен жинап, кейін бағалау", True),
            ("Бірінші идеяны бірден қабылдау", False),
            ("Барлық идеяны жою", False),
            ("Тек стандартты шешімді қолдану", False),
        ]),
        q("multiple_choice", "Балама ML шешімдерін бағалау кезінде нені салыстырасыз?", "creative-thinking", [
            ("Дәлдік", True),
            ("Пайдалану қарапайымдылығы", True),
            ("Тек түсі", False),
            ("Этикалық тәуекелдер", True),
        ]),
    ]


def post_questions() -> list[dict]:
    return [
        q("single_choice", "Шешім ағашының жапырағы нені білдіреді?", "logic-algorithmic", [
            ("Қорытынды шешімді/сыныпты", True),
            ("Кіріс деректерін", False),
            ("Оқыту жылдамдығын", False),
            ("Деректер қорының индексін", False),
        ]),
        q("multiple_choice", "Алгоритмді бағалау кезінде тексерілетін қасиеттерді таңдаңыз.", "logic-algorithmic", [
            ("Қадамдардың дұрыс реттілігі", True),
            ("Барлық жағдайды өңдеуі", True),
            ("Тек қысқалығы", False),
            ("Нәтиженің қайталануы", True),
        ]),
        q("single_choice", "Оқыту және тест жиынтықтарын неге бөледі?", "data-literacy", [
            ("Модельдің жаңа деректердегі нәтижесін бағалау үшін", True),
            ("Деректер санын азайту үшін", False),
            ("Файл көлемін үлкейту үшін", False),
            ("Бағандарды жою үшін", False),
        ]),
        q("multiple_choice", "Деректерді анонимдеу әдістерін таңдаңыз.", "data-literacy", [
            ("Есімді идентификатормен алмастыру", True),
            ("Артық жеке өрістерді жою", True),
            ("Барлық деректерді жариялау", False),
            ("Топтастырып қорытындылау", True),
        ]),
        q("single_choice", "Эксперимент нәтижесінде болжам расталмаса, дұрыс әрекет қандай?", "research-skills", [
            ("Нәтижені тіркеп, себептерді талдау", True),
            ("Деректерді өзгерту", False),
            ("Нәтижені жасыру", False),
            ("Болжамды тексерусіз қабылдау", False),
        ]),
        q("multiple_choice", "Ғылыми қорытындының шектеулерін көрсететін белгілерді таңдаңыз.", "research-skills", [
            ("Іріктеме көлемі", True),
            ("Өлшеу қателігі", True),
            ("Тек бір сәтті нәтиже", False),
            ("Зерттеу жағдайы", True),
        ]),
        q("single_choice", "Инженерлік шешімді жақсартудың дұрыс жолы қандай?", "engineering-design", [
            ("Сынақ нәтижесіне қарап итерация жасау", True),
            ("Ешбір сынақсыз жариялау", False),
            ("Барлық талапты елемеу", False),
            ("Тек дизайнды өзгерту", False),
        ]),
        q("multiple_choice", "Жоба талаптарына жататындарды таңдаңыз.", "engineering-design", [
            ("Пайдаланушы қажеттілігі", True),
            ("Өлшенетін мақсат", True),
            ("Шектеусіз бюджет", False),
            ("Қауіпсіздік талаптары", True),
        ]),
        q("single_choice", "Идеяларды іріктеу кезінде ең дұрыс тәсіл қандай?", "creative-thinking", [
            ("Критерийлер бойынша салыстыру", True),
            ("Бірінші айтылған идеяны таңдау", False),
            ("Идеяларды мүлде талқыламау", False),
            ("Тек қымбат шешімді таңдау", False),
        ]),
        q("multiple_choice", "ML шешімінің әлеуметтік тәуекелдерін таңдаңыз.", "creative-thinking", [
            ("Деректердегі бейтараптық", True),
            ("Жеке өмірдің бұзылуы", True),
            ("Модельдің жылдамдығы", False),
            ("Шешімнің түсініксіздігі", True),
        ]),
    ]


def make_assessment(
    db: Session,
    name: str,
    slug: str,
    kind: str,
    competency_by_slug: dict[str, Competency],
    questions: list[dict],
    demo: bool = True,
) -> Assessment:
    weights = {str(item.id): 1.0 for item in competency_by_slug.values()}
    assessment = Assessment(
        name=name,
        slug=slug,
        kind=kind,
        version=1,
        methodology_key="stem-competencies-demo-v1",
        translation_en={"name": "STEM competencies: " + ("pre-test" if kind == "pre" else "post-test"), "description": "Demonstration assessment. The customer approves the final questions and rubric.", "instructions": "Read each question carefully. One or more answers may be correct."},
        description=(
            "Демонстрациялық диагностика. Нақты сұрақтар мен рубриканы тапсырыс беруші "
            "ғылыми түрде бекітеді."
        ),
        instructions="Әр сұрақты мұқият оқыңыз. Бір немесе бірнеше дұрыс жауап болуы мүмкін.",
        scoring_config_json={
            "weights": weights,
            "thresholds": {"low": 50, "medium": 75},
            "attempt_rule": "first_completed",
            "demo_weights": True,
        },
        attempts_limit=3,
        show_correct_answers=True,
        status="published",
        is_demo=demo,
        published_at=NOW - timedelta(days=30),
    )
    db.add(assessment)
    db.flush()
    for index, item in enumerate(questions, start=1):
        db.add(
            AssessmentQuestion(
                assessment_id=assessment.id,
                type=item["type"],
                body=item["body"],
                body_en=ASSESSMENT_QUESTIONS_EN[kind][index - 1][0],
                competency_id=competency_by_slug[item["competency"]].id,
                points=10,
                options_json=[{**option, "label_en": label} for option, label in zip(item["options"], ASSESSMENT_QUESTIONS_EN[kind][index - 1][1], strict=True)] if item["type"] != "open_text" else [],
                order_no=index,
            )
        )
    db.flush()
    return assessment


def add_attempt(
    db: Session,
    assessment: Assessment,
    student: User,
    assignment: Assignment,
    correct_pattern,
    submitted_at: datetime,
    attempt_no: int = 1,
) -> AssessmentAttempt:
    attempt = AssessmentAttempt(
        assessment_id=assessment.id,
        student_id=student.id,
        assignment_id=assignment.id,
        status="in_progress",
        started_at=submitted_at - timedelta(minutes=35),
        attempt_no=attempt_no,
        assessment_version=assessment.version,
    )
    db.add(attempt)
    db.flush()
    for index, question in enumerate(assessment.questions):
        correct = bool(correct_pattern(index, question))
        options = question.options_json or []
        correct_ids = [str(item["id"]) for item in options if item.get("is_correct")]
        wrong_ids = [str(item["id"]) for item in options if not item.get("is_correct")]
        if correct:
            selected = correct_ids
        else:
            selected = wrong_ids[:1]
        db.add(
            AssessmentAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                answer_json={"selected_option_ids": selected},
                answered_at=submitted_at,
            )
        )
    db.flush()
    db.refresh(attempt)
    score_attempt(db, attempt, assessment)
    attempt.submitted_at = submitted_at
    return attempt


def seed(reset: bool = False) -> None:
    db = SessionLocal()
    try:
        if reset:
            print("Resetting database (development only)...")
            for table in reversed(Base.metadata.sorted_tables):
                db.execute(table.delete())
            db.commit()

        if db.execute(select(func.count()).select_from(User)).scalar_one() > 0:
            print("Database already contains users; seed skipped. Use --reset for a clean demo database.")
            return

        admin = User(
            email=settings.admin_email.lower(),
            password_hash=hash_password(settings.admin_password),
            display_name="Әкімші",
            role="admin",
            status="active",
            must_change_password=False,
        )
        teacher = User(
            email=settings.demo_teacher_email.lower(),
            password_hash=hash_password(settings.demo_teacher_password),
            display_name="Айгүл Нұрланова",
            role="teacher",
            status="active",
        )
        student = User(
            email=settings.demo_student_email.lower(),
            password_hash=hash_password(settings.demo_student_password),
            display_name="Данияр Серіков",
            role="student",
            status="active",
        )
        student2 = User(
            email="student2@mlstem.kz",
            password_hash=hash_password(settings.demo_student_password),
            display_name="Аружан Сәрсенова",
            role="student",
            status="active",
        )
        db.add_all([admin, teacher, student, student2])
        db.flush()

        competency_by_slug: dict[str, Competency] = {}
        for index, item in enumerate(COMPETENCIES, start=1):
            competency = Competency(
                slug=item["slug"],
                title=item["title"],
                translation_en=COMPETENCY_TRANSLATIONS_EN[item["slug"]],
                description=sanitize_html(item["description"]),
                indicators_json=item["indicators"],
                criteria_json=item["criteria"],
                status="published",
                sort_order=index,
                is_demo=True,
                published_at=NOW - timedelta(days=60),
            )
            db.add(competency)
            competency_by_slug[item["slug"]] = competency
        db.flush()

        algorithm_by_slug: dict[str, Algorithm] = {}
        for index, item in enumerate(ALGORITHMS, start=1):
            algorithm = Algorithm(
                slug=item["slug"],
                title=item["title"],
                title_en=item["title_en"],
                translation_en=ALGORITHM_TRANSLATIONS_EN[item["slug"]],
                summary=sanitize_html(item["summary"]),
                body=sanitize_html(item["body"]),
                status="published",
                sort_order=index,
                is_demo=True,
                published_at=NOW - timedelta(days=60),
            )
            db.add(algorithm)
            algorithm_by_slug[item["slug"]] = algorithm
        db.flush()

        lesson_by_slug: dict[str, Lesson] = {}
        for item in LESSONS:
            lesson = Lesson(
                slug=item["slug"],
                title=item["title"],
                translation_en=LESSON_TRANSLATIONS_EN[item["slug"]],
                algorithm_id=algorithm_by_slug[item["algorithm"]].id
                if item.get("algorithm")
                else None,
                summary=sanitize_html(item["summary"]),
                body=sanitize_html(item["body"]),
                goal=sanitize_html(item["goal"]),
                reflection=sanitize_html(item["reflection"]),
                duration_min=item["duration_min"],
                order_no=item["order_no"],
                status="published",
                is_demo=True,
                published_at=NOW - timedelta(days=45),
            )
            db.add(lesson)
            db.flush()
            for competency_slug in item["competencies"]:
                db.add(
                    LessonCompetency(
                        lesson_id=lesson.id,
                        competency_id=competency_by_slug[competency_slug].id,
                    )
                )
            lesson_by_slug[item["slug"]] = lesson

        task_by_slug: dict[str, Task] = {}
        for index, item in enumerate(TASKS, start=1):
            task = Task(
                slug=item["slug"],
                title=item["title"],
                translation_en={"title": TASK_TRANSLATIONS_EN[item["slug"]][0], "instructions": TASK_TRANSLATIONS_EN[item["slug"]][1], "rubric_labels": TASK_RUBRIC_LABELS_EN.get(item["slug"], [])},
                lesson_id=lesson_by_slug[item["lesson"]].id,
                algorithm_id=algorithm_by_slug[item["algorithm"]].id
                if item.get("algorithm")
                else None,
                type=item["type"],
                difficulty=item["difficulty"],
                instructions=sanitize_html(item["instructions"]),
                body="",
                max_score=item["max_score"],
                rubric_json=item.get("rubric", []),
                attempts_limit=2,
                show_correct_answers=True,
                status="published",
                sort_order=index,
                is_demo=True,
                published_at=NOW - timedelta(days=40),
            )
            db.add(task)
            db.flush()
            for competency_slug in item["competencies"]:
                db.add(
                    TaskCompetency(
                        task_id=task.id,
                        competency_id=competency_by_slug[competency_slug].id,
                    )
                )
            for option_index, (label, is_correct) in enumerate(item.get("options", []), start=1):
                db.add(
                    TaskOption(
                        task_id=task.id,
                        label=label,
                        label_en=TASK_TRANSLATIONS_EN[item["slug"]][2][option_index - 1],
                        is_correct=is_correct,
                        order_no=option_index,
                    )
                )
            task_by_slug[item["slug"]] = task
        db.flush()

        project_by_slug: dict[str, Project] = {}
        for index, item in enumerate(PROJECTS, start=1):
            project = Project(
                slug=item["slug"],
                title=item["title"],
                translation_en={**PROJECT_TRANSLATIONS_EN[item["slug"]], "rubric_labels": PROJECT_RUBRIC_LABELS_EN[item["slug"]]},
                algorithm_id=algorithm_by_slug[item["algorithm"]].id
                if item.get("algorithm")
                else None,
                summary=sanitize_html(item["summary"]),
                problem=sanitize_html(item["problem"]),
                goal=sanitize_html(item["goal"]),
                body="<p>Жобаны кезеңдермен орындап, әр қадамда дәлел жинаңыз.</p>",
                steps_json=item["steps"],
                materials_json=item["materials"],
                tools_json=item["tools"],
                expected_result=sanitize_html(item["expected"]),
                rubric_json=item["rubric"],
                status="published",
                sort_order=index,
                is_demo=True,
                published_at=NOW - timedelta(days=35),
            )
            db.add(project)
            db.flush()
            for competency_slug in item["competencies"]:
                db.add(
                    ProjectCompetency(
                        project_id=project.id,
                        competency_id=competency_by_slug[competency_slug].id,
                    )
                )
            project_by_slug[item["slug"]] = project

        resource_specs = [
            ("algorithm", algorithm_by_slug["classification"].id, "Teachable Machine — сурет классификаторы", "https://teachablemachine.withgoogle.com/"),
            ("algorithm", algorithm_by_slug["classification"].id, "Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course"),
            ("algorithm", algorithm_by_slug["linear-regression"].id, "Google Colab", "https://colab.research.google.com/"),
            ("algorithm", algorithm_by_slug["linear-regression"].id, "scikit-learn құжаттамасы", "https://scikit-learn.org/stable/"),
            ("algorithm", algorithm_by_slug["decision-tree"].id, "Scikit-learn Decision Trees", "https://scikit-learn.org/stable/modules/tree.html"),
            ("lesson", lesson_by_slug["teachable-machine-practice"].id, "Teachable Machine практикумы", "https://teachablemachine.withgoogle.com/train/image"),
            ("lesson", lesson_by_slug["linear-regression-model"].id, "Colab бастауыш notebook", "https://colab.research.google.com/"),
            ("lesson", lesson_by_slug["decision-tree-model"].id, "Scikit-learn tree module", "https://scikit-learn.org/stable/modules/tree.html"),
            ("lesson", lesson_by_slug["data-collection-cleaning"].id, "Kaggle ашық деректері", "https://www.kaggle.com/datasets"),
            ("project", project_by_slug["image-classification"].id, "Teachable Machine", "https://teachablemachine.withgoogle.com/"),
            ("project", project_by_slug["weather-forecast"].id, "Google Colab", "https://colab.research.google.com/"),
            ("project", project_by_slug["school-decision-support"].id, "Scikit-learn tree module", "https://scikit-learn.org/stable/modules/tree.html"),
        ]
        for entity_type, entity_id, title, url in resource_specs:
            db.add(
                Resource(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    audience="student",
                    kind=ResourceKind.link.value,
                    title=title,
                    url=url,
                    uploaded_by=admin.id,
                    created_at=NOW - timedelta(days=30),
                )
            )

        classroom = Classroom(
            teacher_id=teacher.id,
            title="10А — Информатика",
            join_code="DEMO10",
            status="active",
        )
        db.add(classroom)
        db.flush()
        for learner in (student, student2):
            db.add(
                ClassroomMember(
                    classroom_id=classroom.id,
                    student_id=learner.id,
                    joined_at=NOW - timedelta(days=25),
                )
            )

        def assign(content_type: str, content_id: uuid.UUID, days: int, notes: str | None = None):
            assignment = Assignment(
                classroom_id=classroom.id,
                content_type=content_type,
                content_id=content_id,
                due_at=NOW + timedelta(days=days),
                created_by=teacher.id,
                status="active",
                notes=notes,
            )
            db.add(assignment)
            db.flush()
            return assignment

        assign("lesson", lesson_by_slug["ml-introduction"].id, 7)
        assignment_task = assign("task", task_by_slug["teachable-model-link"].id, 10)
        assignment_project = assign("project", project_by_slug["image-classification"].id, 21)
        assign("task", task_by_slug["classification-definition"].id, 5)

        pre = make_assessment(
            db,
            "STEM құзыреттіліктері — Pre-test (демо)",
            "stem-competencies-pre-demo",
            "pre",
            competency_by_slug,
            pre_questions(),
        )
        post = make_assessment(
            db,
            "STEM құзыреттіліктері — Post-test (демо)",
            "stem-competencies-post-demo",
            "post",
            competency_by_slug,
            post_questions(),
        )
        assignment_pre = assign("assessment", pre.id, 14, "Оқыту басталғанға дейінгі диагностика")
        assignment_post = assign("assessment", post.id, 30, "Оқытудан кейінгі диагностика")

        # Lesson progress for the demo student.
        for slug in ("ml-introduction", "data-collection-cleaning"):
            db.add(
                LessonProgress(
                    student_id=student.id,
                    lesson_id=lesson_by_slug[slug].id,
                    completed_at=NOW - timedelta(days=6),
                )
            )

        # Demo submissions that need/reflect teacher review.
        db.add(
            Submission(
                assignment_id=assignment_task.id,
                student_id=student.id,
                text="Модель үш сыныпқа бөлінген: қағаз, пластик, шыны. Сынақ нәтижесі презентацияда.",
                link="https://teachablemachine.withgoogle.com/",
                submitted_at=NOW - timedelta(days=2),
                status="submitted",
            )
        )
        db.add(
            Submission(
                assignment_id=assignment_project.id,
                student_id=student2.id,
                text="Жоба прототипі дайын, сынақ журналы қоса берілді.",
                link="https://teachablemachine.withgoogle.com/",
                submitted_at=NOW - timedelta(days=4),
                status="reviewed",
                grade=85,
                feedback="Жақсы жұмыс. Деректер жиынтығын кеңейтіп, қате жағдайларды талдаңыз.",
                reviewed_at=NOW - timedelta(days=3),
                reviewed_by=teacher.id,
            )
        )

        # Demo diagnostic attempts: student 1 has both pre/post, student 2 only pre.
        add_attempt(
            db, pre, student, assignment_pre,
            lambda index, question: index % 2 == 0,
            NOW - timedelta(days=20),
        )
        add_attempt(
            db, post, student, assignment_post,
            lambda index, question: True,
            NOW - timedelta(days=1),
        )
        add_attempt(
            db, pre, student2, assignment_pre,
            lambda index, question: index % 2 == 0,
            NOW - timedelta(days=19),
        )

        db.commit()
        print("Seed completed.")
        print(f"Admin:   {admin.email} / {settings.admin_password}")
        print(f"Teacher: {teacher.email} / {settings.demo_teacher_password}")
        print(f"Student: {student.email} / {settings.demo_student_password}")
        print(f"Student2:{student2.email} / {settings.demo_student_password}")
        print("Class join code: DEMO10")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed ML + STEM LAB demo data")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete all rows from the database before seeding (development only)",
    )
    args = parser.parse_args()
    if args.reset and settings.environment == "production":
        print("Refusing to reset a production database.", file=sys.stderr)
        raise SystemExit(2)
    seed(reset=args.reset)


if __name__ == "__main__":
    main()
