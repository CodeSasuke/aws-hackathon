import os
import sys
import yaml

def verify_and_download():
    print("Initializing offline Model Registry downloader...")
    
    registry_path = os.path.join(os.path.dirname(__file__), "registry.yaml")
    if not os.path.exists(registry_path):
        print(f"Error: Registry file not found at {registry_path}")
        sys.exit(1)
        
    with open(registry_path, "r") as f:
        registry = yaml.safe_load(f)
        
    models = registry.get("models", {})
    
    # 1. Setup spaCy Parser
    parser_info = models.get("parser", {})
    parser_name = parser_info.get("name", "en_core_web_sm")
    print(f"Verifying parser pipeline: '{parser_name}'...")
    try:
        import spacy
        if not spacy.util.is_package(parser_name):
            print(f"Downloading spaCy model '{parser_name}'...")
            from spacy.cli import download
            download(parser_name)
        else:
            print(f"spaCy model '{parser_name}' is already installed.")
    except ImportError:
        print("Error: 'spacy' library is not installed in the current environment.")
        sys.exit(1)

    # 2. Setup Sentence Transformers
    embed_info = models.get("embedding", {})
    embed_name = embed_info.get("name")
    cache_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "cache"))
    os.makedirs(cache_dir, exist_ok=True)
    
    print(f"Verifying embedding model: '{embed_name}' in cache: {cache_dir}...")
    try:
        from sentence_transformers import SentenceTransformer
        # This will download and save it to the local cache dir if not present
        model = SentenceTransformer(embed_name, cache_folder=cache_dir)
        print(f"SentenceTransformer model '{embed_name}' is successfully cached locally.")
    except ImportError:
        print("Error: 'sentence-transformers' library is not installed in the current environment.")
        sys.exit(1)
    except Exception as e:
        print(f"Failed to load/cache sentence transformer: {e}")
        sys.exit(1)
        
    print("\nModel registry verification completed successfully! All models ready for offline inference.")

if __name__ == "__main__":
    verify_and_download()
