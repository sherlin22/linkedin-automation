# linkedin_automation.py
import os
import json
import base64
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Define the scopes you need
SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly'
]

def authenticate_google_services():
    """Authenticate and return Google services"""
    creds = None
    
    # token.json stores the user's access and refresh tokens
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # If there are no (valid) credentials available, let the user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=8080)
        
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    
    # Build all services
    drive_service = build('drive', 'v3', credentials=creds)
    sheets_service = build('sheets', 'v4', credentials=creds)
    gmail_service = build('gmail', 'v1', credentials=creds)
    
    return drive_service, sheets_service, gmail_service

def step7_test_sheets_read(sheets):
    """Step 7: Test reading from Master Tracker"""
    print("\n" + "="*50)
    print("STEP 7: TESTING GOOGLE SHEETS READ ACCESS")
    print("="*50)
    
    try:
        # Your Master Tracker spreadsheet ID
        spreadsheet_id = "1Oy6ftjn5xybHBh1br3LflBj5rgaD3xcuK32nrX7uHAM"
        range_name = "Sheet1!A1:D10"  # Adjust sheet name and range as needed

        print(f"📊 Reading from Master Tracker...")
        result = sheets.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id, 
            range=range_name
        ).execute()
        values = result.get('values', [])
        
        if not values:
            print('✅ Sheets access working, but no data found in range A1:D10')
        else:
            print(f'✅ Successfully read {len(values)} rows from Master Tracker:')
            for i, row in enumerate(values[:5]):  # Show first 5 rows
                print(f"   Row {i+1}: {row}")
        
        return True
        
    except HttpError as error:
        print(f"❌ Sheets Error: {error}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def step8_test_gmail_send(gmail):
    """Step 8: Test sending email via Gmail"""
    print("\n" + "="*50)
    print("STEP 8: TESTING GMAIL SEND FUNCTION")
    print("="*50)
    
    try:
        # Create a test email
        test_message = (
            "From: me\n"
            "To: deeparajan890@gmail.com\n"  # Send to yourself for testing
            "Subject: LinkedIn Automation Test Email\n"
            "\n"
            "This is a test email from your LinkedIn Automation system.\n"
            "If you received this, Gmail integration is working correctly!\n"
            "\n"
            "✅ System is ready for automation."
        )

        message = {
            'raw': base64.urlsafe_b64encode(
                test_message.encode()
            ).decode()
        }

        print("📧 Sending test email...")
        sent_message = gmail.users().messages().send(
            userId='me', 
            body=message
        ).execute()
        
        print(f'✅ Test email sent successfully! Message ID: {sent_message["id"]}')
        print('📨 Check your inbox for the test email')
        return True
        
    except HttpError as error:
        print(f"❌ Gmail Error: {error}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def upload_resume_to_drive(drive, file_path, candidate_name, is_readable=True):
    """Upload a resume file to the LinkedIn Resumes folder with readable/unreadable organization"""
    try:
        # Load folder configuration
        with open('drive_config.json', 'r') as f:
            config = json.load(f)
        main_folder_id = config['resume_folder_id']
        
        # Create subfolders for readable/unreadable
        readable_folder_id = find_or_create_folder(drive, "Readable", main_folder_id)
        unreadable_folder_id = find_or_create_folder(drive, "Unreadable", main_folder_id)
        
        # Choose the appropriate folder
        target_folder_id = readable_folder_id if is_readable else unreadable_folder_id
        
        # Create file metadata
        file_name = f"Resume_{candidate_name}_{os.path.basename(file_path)}"
        file_metadata = {
            'name': file_name,
            'parents': [target_folder_id]
        }
        
        # Upload file
        from googleapiclient.http import MediaFileUpload
        media = MediaFileUpload(file_path, resumable=True)
        
        file = drive.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,name,webViewLink'
        ).execute()
        
        folder_type = "Readable" if is_readable else "Unreadable"
        print(f"✅ Uploaded {folder_type.lower()} resume: {file.get('name')}")
        print(f"🔗 File URL: {file.get('webViewLink')}")
        return file.get('id')
        
    except Exception as e:
        print(f"❌ Failed to upload resume: {e}")
        return None

def find_or_create_folder(drive, folder_name, parent_folder_id):
    """Find or create a folder within a parent folder"""
    try:
        # Search for existing folder
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and '{parent_folder_id}' in parents and trashed=false"
        results = drive.files().list(q=query, fields="files(id, name)").execute()
        folders = results.get('files', [])
        
        if folders:
            return folders[0]['id']
        
        # Create new folder
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_folder_id]
        }
        
        folder = drive.files().create(body=folder_metadata, fields='id').execute()
        print(f"📁 Created Drive folder: {folder_name}")
        return folder.get('id')
        
    except Exception as e:
        print(f"❌ Failed to create folder {folder_name}: {e}")
        return parent_folder_id  # Fallback to main folder
        
def step9_test_drive_access(drive):
    """Step 9: Test Drive folder access"""
    print("\n" + "="*50)
    print("STEP 9: TESTING DRIVE FOLDER ACCESS")
    print("="*50)
    
    try:
        # Load the folder ID from our config
        try:
            with open('drive_config.json', 'r') as f:
                config = json.load(f)
            folder_id = config['resume_folder_id']
            folder_name = config['resume_folder_name']
            print(f"📁 Using configured folder: {folder_name} (ID: {folder_id})")
        except FileNotFoundError:
            # Fallback: search for the folder by name
            print("📁 Searching for LinkedIn Resumes folder...")
            files = drive.files().list(
                q="name='LinkedIn Resumes' and mimeType='application/vnd.google-apps.folder'", 
                fields="files(id, name, mimeType)"
            ).execute()
            
            folders = files.get('files', [])
            
            if folders:
                folder_id = folders[0]['id']
                folder_name = folders[0]['name']
                print(f"✅ Found folder: {folder_name} (ID: {folder_id})")
            else:
                print("❌ No LinkedIn Resumes folder found")
                return False
        
        # Test 2: List files inside the folder
        print(f"📂 Checking contents of {folder_name}...")
        folder_files = drive.files().list(
            q=f"'{folder_id}' in parents",
            fields="files(id, name, mimeType, createdTime)",
            pageSize=5
        ).execute()
        
        files_in_folder = folder_files.get('files', [])
        
        if files_in_folder:
            print(f"✅ Folder contains {len(files_in_folder)} files:")
            for file in files_in_folder:
                print(f"   - {file['name']} ({file['mimeType']})")
        else:
            print("ℹ️  Folder is empty (ready for resumes)")
        
        # Test 3: Check if we can upload (simulate)
        print("✅ Drive access test completed successfully")
        return True
        
    except HttpError as error:
        print(f'❌ Drive access error: {error}')
        return False

def upload_resume_to_drive(drive, file_path, candidate_name):
    """Upload a resume file to the LinkedIn Resumes folder"""
    try:
        # Load folder configuration
        with open('drive_config.json', 'r') as f:
            config = json.load(f)
        folder_id = config['resume_folder_id']
        
        # Create file metadata
        file_name = f"Resume_{candidate_name}_{os.path.basename(file_path)}"
        file_metadata = {
            'name': file_name,
            'parents': [folder_id]
        }
        
        # Upload file
        from googleapiclient.http import MediaFileUpload
        media = MediaFileUpload(file_path, resumable=True)
        
        file = drive.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,name,webViewLink'
        ).execute()
        
        print(f"✅ Uploaded resume: {file.get('name')}")
        print(f"🔗 File URL: {file.get('webViewLink')}")
        return file.get('id')
        
    except Exception as e:
        print(f"❌ Failed to upload resume: {e}")
        return None

def main():
    print("🚀 LINKEDIN AUTOMATION - COMPLETE SYSTEM TEST")
    print("="*60)
    
    try:
        # Authenticate and get services
        drive, sheets, gmail = authenticate_google_services()
        print("✅ Authentication successful!")
        
        # Run all test steps
        step7_success = step7_test_sheets_read(sheets)
        step8_success = step8_test_gmail_send(gmail)
        step9_success = step9_test_drive_access(drive)
        
        # Final summary
        print("\n" + "="*60)
        print("🎯 TEST RESULTS SUMMARY")
        print("="*60)
        print(f"Step 7 - Sheets Read: {'✅ PASS' if step7_success else '❌ FAIL'}")
        print(f"Step 8 - Gmail Send:  {'✅ PASS' if step8_success else '❌ FAIL'}")
        print(f"Step 9 - Drive Access: {'✅ PASS' if step9_success else '❌ FAIL'}")
        
        if all([step7_success, step8_success, step9_success]):
            print("\n🎉 ALL SYSTEMS GO! Your LinkedIn automation is fully operational!")
            print("\n📋 Next steps:")
            print("   1. Check your email for the test message")
            print("   2. Review the data read from your Master Tracker")
            print("   3. Start building your automation logic")
        else:
            print("\n⚠️  Some tests failed. Check the errors above.")
            
        return drive, sheets, gmail
        
    except Exception as e:
        print(f"❌ Critical Error: {e}")
        return None, None, None

if __name__ == '__main__':
    main()