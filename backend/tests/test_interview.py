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
