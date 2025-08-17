import os
import json

ref_file = "de.json"
required_files = ["en.json", "es.json", "fr.json", "hi.json", "it.json", "jp.json", "uk.json", "zhs.json", "zht.json"]
base_dir = "../src/assets/i18n"

def extract_keys(obj, prefix=""):
    keys = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            full_key = f"{prefix}{k}" if prefix == "" else f"{prefix}.{k}"
            if isinstance(v, dict):
                keys.extend(extract_keys(v, full_key))
            else:
                keys.append(full_key)
    return keys

something_missing = False
for root, dirs, files in os.walk(base_dir):
    if ref_file in files:
        missing = [f for f in required_files if f not in files]
        if missing:
            something_missing = True
            print(f"\nIn directory '{root}' are the following files missing:\n")
            for m in missing:
                print(f" - {m}")
        else:
            # check if all translations are in this file
            ref_path = os.path.join(root, ref_file)

            try:
                with open(ref_path, "r", encoding="utf-8") as f:
                    ref_json = json.load(f)
            except Exception as e:
                print(f"Error while loading '{ref_path}': {e}\n")
                continue

            ref_keys = extract_keys(ref_json)

            for req in required_files:
                if req in files:
                    req_path = os.path.join(root, req)
                    try:
                        with open(req_path, "r", encoding="utf-8") as f:
                            req_json = json.load(f)
                    except Exception as e:
                        print(f"Error while loading '{req_path}': {e}\n")
                        continue

                    req_keys = extract_keys(req_json)
                    missing_keys = [k for k in ref_keys if k not in req_keys]

                    if missing_keys:
                        something_missing = True
                        print(f"\nFile '{req_path}' has missing translations:")
                        for k in missing_keys:
                            print(f" - {k}")



if not something_missing:
    print("\nAll translations are present.\n")
