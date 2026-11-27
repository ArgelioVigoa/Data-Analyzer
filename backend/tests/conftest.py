import pytest
from app.main import app

@pytest.fixture(autouse=True)
def _limiter_off_for_tests():
    """The production limiter (e.g. 5 registrations/hour/IP) would make a test-suite that creates several accounts fail with 429.
    It is disabled ONLY while testing; test_rate_limit_still_enforced_when_enabled proves the control still works."""
    lim = app.state.limiter; lim.enabled = False
    yield
    lim.enabled = True
