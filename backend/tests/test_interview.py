import pytest
from app.schemas.brands import InterviewAnswer, GenerateVoiceConfigRequest


def test_interview_answer_has_stage():
    a = InterviewAnswer(question_index=0, question="Q", answer="A", stage=1)
    assert a.stage == 1


def test_interview_answer_stage_defaults_to_1():
    a = InterviewAnswer(question_index=0, question="Q", answer="A")
    assert a.stage == 1


def test_generate_voice_config_request_accepts_stage_on_answers():
    req = GenerateVoiceConfigRequest(
        brand_name="Acme",
        industry="Tech",
        interview_answers=[
            InterviewAnswer(question_index=0, question="Q1", answer="We help founders", stage=1),
            InterviewAnswer(question_index=2, question="Q3", answer="Bold, Direct", stage=1),
        ],
        sample_posts=[],
    )
    assert req.interview_answers[0].stage == 1
    assert req.interview_answers[1].stage == 1


from app.routers.brands import INTERVIEW_QUESTIONS


def test_interview_questions_is_list_of_dicts():
    assert isinstance(INTERVIEW_QUESTIONS, list)
    assert len(INTERVIEW_QUESTIONS) > 0
    assert isinstance(INTERVIEW_QUESTIONS[0], dict)


def test_each_question_has_required_keys():
    required = {"index", "stage", "question", "input_type"}
    for q in INTERVIEW_QUESTIONS:
        assert required.issubset(q.keys()), f"Missing keys in: {q}"


def test_stage_1_has_exactly_4_questions():
    stage1 = [q for q in INTERVIEW_QUESTIONS if q["stage"] == 1]
    assert len(stage1) == 4


def test_stage_2_has_exactly_4_questions():
    stage2 = [q for q in INTERVIEW_QUESTIONS if q["stage"] == 2]
    assert len(stage2) == 4


def test_chip_questions_have_chips_list():
    chip_questions = [q for q in INTERVIEW_QUESTIONS if q["input_type"] in ("single_chip", "multi_chip")]
    for q in chip_questions:
        assert "chips" in q, f"Chip question missing chips: {q['question']}"
        assert len(q["chips"]) > 0


def test_multi_chip_questions_have_max_select():
    multi = [q for q in INTERVIEW_QUESTIONS if q["input_type"] == "multi_chip"]
    for q in multi:
        assert "max_select" in q, f"Multi-chip question missing max_select: {q['question']}"


from app.services.anthropic_service import _build_voice_config_prompt


def test_voice_config_prompt_renders_chip_answers_distinctly():
    answers = [
        {"question_index": 0, "question": "What does your brand do?", "answer": "We help founders", "stage": 1},
        {"question_index": 1, "question": "Who are you writing for?", "answer": "Startup Founders", "stage": 1},
        {"question_index": 2, "question": "Pick up to 3 words...", "answer": "Bold, Direct, Expert", "stage": 1},
    ]
    prompt = _build_voice_config_prompt("Acme", "Tech", answers, [])
    assert "Startup Founders" in prompt
    assert "Bold, Direct, Expert" in prompt
    assert "Acme" in prompt


def test_voice_config_prompt_includes_stage2_when_provided():
    answers = [
        {"question_index": 0, "question": "What does your brand do?", "answer": "We help founders", "stage": 1},
        {"question_index": 4, "question": "Biggest problems solved?", "answer": "Clients waste 3 hours on reports", "stage": 2},
    ]
    prompt = _build_voice_config_prompt("Acme", "Tech", answers, [])
    assert "Clients waste 3 hours on reports" in prompt


def test_voice_config_prompt_works_without_stage2():
    answers = [
        {"question_index": 0, "question": "What does your brand do?", "answer": "We help founders", "stage": 1},
    ]
    prompt = _build_voice_config_prompt("Acme", "Tech", answers, [])
    assert "Acme" in prompt
    assert "We help founders" in prompt
