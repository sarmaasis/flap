# flap (Python)

Thin REST client. Install by copying `flap.py` or vendoring.

```python
from flap import Flap
client = Flap("flap_live_...")
client.send({"from": "hello@yourdomain.com", "to": ["a@b.com"], "subject": "Hi", "html": "Hello"})
```
