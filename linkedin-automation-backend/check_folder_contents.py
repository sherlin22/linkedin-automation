# check_folder_contents.py
import os
import json 
from linkedin_automation import authenticate_google_services

def check_folder_contents():
    print("📂 Checking Folder Contents...")
    
    drive, sheets, gmail = authenticate_google_services()
    
    try:
        with open('drive_config.json', 'r') as f:
            config = json.load(f)
        
        folder_id = config['resume_folder_id']
        
        # List all files in the folder
        results = drive.files().list(
            q=f"'{folder_id}' in parents",
            fields="files(id, name, mimeType, createdTime, size)",
            pageSize=20
        ).execute()
        
        files = results.get('files', [])
        
        print(f"📁 Folder: {config['resume_folder_name']}")
        print(f"📊 Total files: {len(files)}")
        print("="*50)
        
        if files:
            for i, file in enumerate(files, 1):
                print(f"{i}. {file['name']}")
                print(f"   📄 Type: {file['mimeType']}")
                print(f"   🕐 Created: {file['createdTime']}")
                if 'size' in file:
                    print(f"   📏 Size: {file['size']} bytes")
                print()
        else:
            print("📭 Folder is empty (ready for resumes!)")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    check_folder_contents()