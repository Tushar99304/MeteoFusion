import importlib.util
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Make the backend directory behave as the "backend" package
# inside Vercel's isolated backend service.
package = types.ModuleType("backend")
package.__path__ = [str(ROOT)]
package.__package__ = "backend"
sys.modules["backend"] = package

# Load the existing backend/main.py as backend.main
main_path = ROOT / "main.py"
spec = importlib.util.spec_from_file_location(
    "backend.main",
    main_path,
    submodule_search_locations=[str(ROOT)],
)

module = importlib.util.module_from_spec(spec)
sys.modules["backend.main"] = module
spec.loader.exec_module(module)

app = module.app