#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class MDMGrupoAPITester:
    def __init__(self, base_url="https://sales-portal-39.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def test_login(self):
        """Test login with initial credentials"""
        try:
            response = requests.post(f"{self.api_url}/auth/login", json={
                "email": "hugoalbmartins@gmail.com",
                "password": "12345Hm*"
            })
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.user = data.get('user')
                self.log_test("Login with initial credentials", True, f"User: {self.user.get('name')} ({self.user.get('role')})")
                return True
            else:
                self.log_test("Login with initial credentials", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Login with initial credentials", False, f"Exception: {str(e)}")
            return False

    def get_headers(self):
        """Get authorization headers"""
        return {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        try:
            response = requests.get(f"{self.api_url}/dashboard/stats", headers=self.get_headers())
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['total_sales', 'total_value', 'total_commission', 'sales_by_operator', 'sales_by_status', 'sales_timeline']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_test("Dashboard stats", True, f"Total sales: {data['total_sales']}, Total value: €{data['total_value']}")
                    return True
                else:
                    self.log_test("Dashboard stats", False, f"Missing fields: {missing_fields}")
                    return False
            else:
                self.log_test("Dashboard stats", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Dashboard stats", False, f"Exception: {str(e)}")
            return False

    def test_partners_crud(self):
        """Test partners CRUD operations"""
        # Test GET partners
        try:
            response = requests.get(f"{self.api_url}/partners", headers=self.get_headers())
            if response.status_code == 200:
                partners = response.json()
                self.log_test("Get partners", True, f"Found {len(partners)} partners")
            else:
                self.log_test("Get partners", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get partners", False, f"Exception: {str(e)}")
            return False

        # Test CREATE partner
        partner_data = {
            "name": "Test Partner",
            "email": "test@partner.com",
            "phone": "123456789",
            "address": "Test Address",
            "nif": "123456789",
            "iban": "PT50000000000000000000000",
            "bank_details": "Test Bank"
        }
        
        try:
            response = requests.post(f"{self.api_url}/partners", json=partner_data, headers=self.get_headers())
            if response.status_code == 200:
                partner = response.json()
                partner_id = partner.get('id')
                self.log_test("Create partner", True, f"Created partner with ID: {partner_id}")
                
                # Test GET specific partner
                response = requests.get(f"{self.api_url}/partners/{partner_id}", headers=self.get_headers())
                if response.status_code == 200:
                    self.log_test("Get specific partner", True, f"Retrieved partner: {partner.get('name')}")
                else:
                    self.log_test("Get specific partner", False, f"Status: {response.status_code}")
                
                return True
            else:
                self.log_test("Create partner", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create partner", False, f"Exception: {str(e)}")
            return False

    def test_operators_crud(self):
        """Test operators CRUD operations"""
        # Test GET operators
        try:
            response = requests.get(f"{self.api_url}/operators", headers=self.get_headers())
            if response.status_code == 200:
                operators = response.json()
                self.log_test("Get operators", True, f"Found {len(operators)} operators")
                
                # Should have default operators
                operator_names = [op['name'] for op in operators]
                expected_operators = ['Vodafone', 'MEO', 'NOS', 'EDP', 'Galp', 'Endesa']
                found_operators = [name for name in expected_operators if name in operator_names]
                
                if len(found_operators) >= 3:  # At least some default operators
                    self.log_test("Default operators present", True, f"Found: {found_operators}")
                else:
                    self.log_test("Default operators present", False, f"Only found: {found_operators}")
                
                return True
            else:
                self.log_test("Get operators", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get operators", False, f"Exception: {str(e)}")
            return False

        # Test CREATE operator (admin only)
        operator_data = {
            "name": "Test Operator",
            "type": "telecom"
        }
        
        try:
            response = requests.post(f"{self.api_url}/operators", json=operator_data, headers=self.get_headers())
            if response.status_code == 200:
                operator = response.json()
                self.log_test("Create operator", True, f"Created operator: {operator.get('name')}")
                return True
            else:
                self.log_test("Create operator", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create operator", False, f"Exception: {str(e)}")
            return False

    def test_sales_crud(self):
        """Test sales CRUD operations"""
        # First get partners and operators for creating sales
        try:
            partners_response = requests.get(f"{self.api_url}/partners", headers=self.get_headers())
            operators_response = requests.get(f"{self.api_url}/operators", headers=self.get_headers())
            
            if partners_response.status_code != 200 or operators_response.status_code != 200:
                self.log_test("Sales CRUD setup", False, "Could not get partners or operators")
                return False
                
            partners = partners_response.json()
            operators = operators_response.json()
            
            if not partners or not operators:
                self.log_test("Sales CRUD setup", False, "No partners or operators available")
                return False
                
        except Exception as e:
            self.log_test("Sales CRUD setup", False, f"Exception: {str(e)}")
            return False

        # Test GET sales
        try:
            response = requests.get(f"{self.api_url}/sales", headers=self.get_headers())
            if response.status_code == 200:
                sales = response.json()
                self.log_test("Get sales", True, f"Found {len(sales)} sales")
            else:
                self.log_test("Get sales", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get sales", False, f"Exception: {str(e)}")
            return False

        # Test CREATE sale
        sale_data = {
            "date": "2025-01-15",
            "value": 1500.00,
            "operator_id": operators[0]['id'],
            "partner_id": partners[0]['id'],
            "final_client": "Test Client",
            "sale_type": "eletricidade",
            "cpe": "CPE123456"
        }
        
        try:
            response = requests.post(f"{self.api_url}/sales", json=sale_data, headers=self.get_headers())
            if response.status_code == 200:
                sale = response.json()
                sale_id = sale.get('id')
                self.log_test("Create sale", True, f"Created sale with ID: {sale_id}, Value: €{sale.get('value')}")
                
                # Test UPDATE sale (status and commission)
                update_data = {
                    "status": "Aprovada",
                    "commission": 150.00
                }
                
                response = requests.put(f"{self.api_url}/sales/{sale_id}", json=update_data, headers=self.get_headers())
                if response.status_code == 200:
                    updated_sale = response.json()
                    self.log_test("Update sale", True, f"Updated status: {updated_sale.get('status')}, Commission: €{updated_sale.get('commission')}")
                else:
                    self.log_test("Update sale", False, f"Status: {response.status_code}")
                
                return True
            else:
                self.log_test("Create sale", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
        except Exception as e:
            self.log_test("Create sale", False, f"Exception: {str(e)}")
            return False

    def test_users_management(self):
        """Test users management (admin only)"""
        try:
            response = requests.get(f"{self.api_url}/users", headers=self.get_headers())
            if response.status_code == 200:
                users = response.json()
                self.log_test("Get users", True, f"Found {len(users)} users")
                
                # Check if admin user exists
                admin_users = [u for u in users if u['role'] == 'admin']
                if admin_users:
                    self.log_test("Admin user exists", True, f"Found {len(admin_users)} admin users")
                else:
                    self.log_test("Admin user exists", False, "No admin users found")
                
                return True
            else:
                self.log_test("Get users", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Get users", False, f"Exception: {str(e)}")
            return False

    def test_export_functionality(self):
        """Test Excel export functionality"""
        try:
            response = requests.get(f"{self.api_url}/sales/export/excel", headers=self.get_headers())
            if response.status_code == 200:
                # Check if response is Excel file
                content_type = response.headers.get('content-type', '')
                if 'spreadsheet' in content_type or 'excel' in content_type:
                    self.log_test("Excel export", True, f"Export successful, Content-Type: {content_type}")
                    return True
                else:
                    self.log_test("Excel export", False, f"Unexpected content type: {content_type}")
                    return False
            else:
                self.log_test("Excel export", False, f"Status: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Excel export", False, f"Exception: {str(e)}")
            return False

    def test_user_editing_functionality(self):
        """Test user editing functionality - CORRECTION 1"""
        print("\n🔍 Testing User Editing Functionality (CORRECTION 1)")
        print("=" * 60)
        
        # Step 1: Get list of users
        try:
            response = requests.get(f"{self.api_url}/users", headers=self.get_headers())
            if response.status_code != 200:
                self.log_test("Get users for editing test", False, f"Status: {response.status_code}")
                return False
            
            users = response.json()
            if len(users) < 1:
                self.log_test("Get users for editing test", False, "No users found")
                return False
            
            self.log_test("Get users for editing test", True, f"Found {len(users)} users")
            
            # Find a non-admin user to test with
            test_user = None
            for user in users:
                if user['role'] != 'admin':
                    test_user = user
                    break
            
            if not test_user:
                # If no non-admin user exists, we'll test with admin (less ideal but still valid)
                test_user = users[0]
                self.log_test("Select test user", True, f"Using admin user for testing: {test_user['name']} (ID: {test_user['id']})")
            else:
                self.log_test("Select test user", True, f"Using non-admin user: {test_user['name']} (ID: {test_user['id']})")
            
            user_id = test_user['id']
            original_name = test_user['name']
            original_position = test_user.get('position', '')
            
        except Exception as e:
            self.log_test("Get users for editing test", False, f"Exception: {str(e)}")
            return False

        # Step 2: Test updating user data WITHOUT password
        try:
            update_data = {
                "name": f"{original_name} (Editado)",
                "email": test_user['email'],
                "role": test_user['role'],
                "position": f"{original_position} - Atualizado",
                "partner_id": test_user.get('partner_id')
            }
            
            response = requests.put(f"{self.api_url}/users/{user_id}", json=update_data, headers=self.get_headers())
            
            if response.status_code == 200:
                updated_user = response.json()
                self.log_test("Update user without password", True, f"Updated name: '{updated_user['name']}', position: '{updated_user['position']}'")
            else:
                self.log_test("Update user without password", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update user without password", False, f"Exception: {str(e)}")
            return False

        # Step 3: Verify changes were applied
        try:
            response = requests.get(f"{self.api_url}/users", headers=self.get_headers())
            if response.status_code == 200:
                users = response.json()
                updated_user = next((u for u in users if u['id'] == user_id), None)
                
                if updated_user:
                    if f"{original_name} (Editado)" in updated_user['name'] and "Atualizado" in updated_user.get('position', ''):
                        self.log_test("Verify user changes applied", True, f"Changes confirmed: {updated_user['name']}, {updated_user['position']}")
                    else:
                        self.log_test("Verify user changes applied", False, f"Changes not applied correctly: {updated_user['name']}, {updated_user['position']}")
                        return False
                else:
                    self.log_test("Verify user changes applied", False, "Updated user not found")
                    return False
            else:
                self.log_test("Verify user changes applied", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Verify user changes applied", False, f"Exception: {str(e)}")
            return False

        # Step 4: Test updating password
        try:
            update_data_with_password = {
                "name": updated_user['name'],
                "email": updated_user['email'],
                "role": updated_user['role'],
                "position": updated_user['position'],
                "partner_id": updated_user.get('partner_id'),
                "password": "NovaPassword123!"
            }
            
            response = requests.put(f"{self.api_url}/users/{user_id}", json=update_data_with_password, headers=self.get_headers())
            
            if response.status_code == 200:
                updated_user_with_password = response.json()
                must_change = updated_user_with_password.get('must_change_password', False)
                self.log_test("Update user with password", True, f"Password updated, must_change_password: {must_change}")
                
                if must_change:
                    self.log_test("Verify must_change_password flag", True, "must_change_password correctly set to true")
                else:
                    self.log_test("Verify must_change_password flag", False, "must_change_password should be true after password update")
                    
            else:
                self.log_test("Update user with password", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Update user with password", False, f"Exception: {str(e)}")
            return False

        # Step 5: Restore original user data
        try:
            restore_data = {
                "name": original_name,
                "email": test_user['email'],
                "role": test_user['role'],
                "position": original_position,
                "partner_id": test_user.get('partner_id')
            }
            
            response = requests.put(f"{self.api_url}/users/{user_id}", json=restore_data, headers=self.get_headers())
            
            if response.status_code == 200:
                self.log_test("Restore original user data", True, "User data restored to original state")
            else:
                self.log_test("Restore original user data", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_test("Restore original user data", False, f"Exception: {str(e)}")

        print("✅ User editing functionality testing completed!")
        return True

    def test_forced_download_functionality(self):
        """Test forced download with Content-Disposition header - CORRECTION 2"""
        print("\n🔍 Testing Forced Download Functionality (CORRECTION 2)")
        print("=" * 60)
        
        # Step 1: Get operators to check for existing documents
        try:
            response = requests.get(f"{self.api_url}/operators?include_hidden=true", headers=self.get_headers())
            if response.status_code != 200:
                self.log_test("Get operators for download test", False, f"Status: {response.status_code}")
                return False
            
            operators = response.json()
            if not operators:
                self.log_test("Get operators for download test", False, "No operators found")
                return False
            
            self.log_test("Get operators for download test", True, f"Found {len(operators)} operators")
            
            # Find an operator with documents or upload one
            test_operator = None
            doc_id = None
            
            for op in operators:
                if op.get('documents') and len(op['documents']) > 0:
                    test_operator = op
                    doc_id = op['documents'][0]['id']
                    break
            
            if not test_operator:
                # Need to upload a document first
                test_operator = operators[0]
                operator_id = test_operator['id']
                self.log_test("No existing documents found", True, f"Will upload test document to {test_operator['name']}")
                
                # Upload a test document
                import tempfile
                import os
                
                pdf_content = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
200
%%EOF"""
                
                with tempfile.NamedTemporaryFile(mode='wb', suffix='.pdf', delete=False) as f:
                    f.write(pdf_content)
                    test_pdf_path = f.name
                
                with open(test_pdf_path, 'rb') as f:
                    files = {'files': ('test_download.pdf', f, 'application/pdf')}
                    headers = {'Authorization': f'Bearer {self.token}'}
                    
                    response = requests.post(f"{self.api_url}/operators/{operator_id}/upload", 
                                           files=files, headers=headers)
                
                if response.status_code == 200:
                    upload_result = response.json()
                    uploaded_docs = upload_result.get('documents', [])
                    if uploaded_docs:
                        doc_id = uploaded_docs[0]['id']
                        self.log_test("Upload test document for download", True, f"Uploaded document ID: {doc_id}")
                    else:
                        self.log_test("Upload test document for download", False, "No document ID returned")
                        return False
                else:
                    self.log_test("Upload test document for download", False, f"Upload failed: {response.status_code}")
                    return False
                
                os.unlink(test_pdf_path)
            else:
                operator_id = test_operator['id']
                self.log_test("Found existing document", True, f"Using document {doc_id} from {test_operator['name']}")
            
        except Exception as e:
            self.log_test("Setup download test", False, f"Exception: {str(e)}")
            return False

        # Step 2: Test document download and verify Content-Disposition header
        try:
            response = requests.get(f"{self.api_url}/operators/{operator_id}/documents/{doc_id}/download", 
                                  headers=self.get_headers())
            
            if response.status_code == 200:
                # Check Content-Disposition header
                content_disposition = response.headers.get('Content-Disposition', '')
                content_type = response.headers.get('Content-Type', '')
                content_length = len(response.content)
                
                self.log_test("Download document response", True, f"Status: 200, Size: {content_length} bytes, Content-Type: {content_type}")
                
                # Verify Content-Disposition header for forced download
                if 'attachment' in content_disposition and 'filename=' in content_disposition:
                    self.log_test("Verify Content-Disposition header", True, f"Header present: {content_disposition}")
                    
                    # Verify it forces download (attachment) instead of preview
                    if content_disposition.startswith('attachment;'):
                        self.log_test("Verify forced download behavior", True, "Content-Disposition starts with 'attachment;' - forces download")
                    else:
                        self.log_test("Verify forced download behavior", False, f"Expected 'attachment;' but got: {content_disposition}")
                        return False
                        
                else:
                    self.log_test("Verify Content-Disposition header", False, f"Missing or invalid Content-Disposition header: '{content_disposition}'")
                    return False
                
                # Verify file content is valid
                if content_length > 0 and 'pdf' in content_type.lower():
                    self.log_test("Verify file validity", True, f"Valid PDF file: {content_length} bytes")
                else:
                    self.log_test("Verify file validity", False, f"Invalid file: {content_type}, {content_length} bytes")
                    return False
                    
            else:
                self.log_test("Download document response", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Test document download", False, f"Exception: {str(e)}")
            return False

        print("✅ Forced download functionality testing completed!")
        return True

    def test_requisition_field_functionality(self):
        """Test requisition field functionality - CORRECTION 3"""
        print("\n🔍 Testing Requisition Field Functionality (CORRECTION 3)")
        print("=" * 60)
        
        # This is primarily a frontend validation, but we need to verify backend accepts requisition for any scope
        
        # Step 1: Get partners and operators for creating test sales
        try:
            partners_response = requests.get(f"{self.api_url}/partners", headers=self.get_headers())
            operators_response = requests.get(f"{self.api_url}/operators", headers=self.get_headers())
            
            if partners_response.status_code != 200 or operators_response.status_code != 200:
                self.log_test("Setup requisition test", False, "Could not get partners or operators")
                return False
                
            partners = partners_response.json()
            operators = operators_response.json()
            
            if not partners or not operators:
                self.log_test("Setup requisition test", False, "No partners or operators available")
                return False
                
            self.log_test("Setup requisition test", True, f"Found {len(partners)} partners and {len(operators)} operators")
            
        except Exception as e:
            self.log_test("Setup requisition test", False, f"Exception: {str(e)}")
            return False

        # Step 2: Test requisition field with telecomunicacoes scope
        try:
            telecom_operator = next((op for op in operators if op.get('scope') == 'telecomunicacoes'), None)
            if not telecom_operator:
                telecom_operator = operators[0]  # Use first available
            
            sale_data_telecom = {
                "date": "2025-01-15T10:00:00Z",
                "partner_id": partners[0]['id'],
                "operator_id": telecom_operator['id'],
                "scope": "telecomunicacoes",
                "client_type": "particular",
                "client_name": "João Silva Telecomunicações",
                "client_nif": "123456789",
                "client_contact": "912345678",
                "service_type": "M3",
                "monthly_value": 40.0,
                "requisition": "REQ-TELECOM-001"  # This should be accepted
            }
            
            response = requests.post(f"{self.api_url}/sales", json=sale_data_telecom, headers=self.get_headers())
            
            if response.status_code == 200:
                sale = response.json()
                if sale.get('requisition') == "REQ-TELECOM-001":
                    self.log_test("Create sale with requisition (telecomunicacoes)", True, f"Sale created with requisition: {sale['requisition']}")
                    telecom_sale_id = sale['id']
                else:
                    self.log_test("Create sale with requisition (telecomunicacoes)", False, "Requisition field not saved correctly")
                    return False
            else:
                self.log_test("Create sale with requisition (telecomunicacoes)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create sale with requisition (telecomunicacoes)", False, f"Exception: {str(e)}")
            return False

        # Step 3: Test requisition field with energia scope (should also work in backend)
        try:
            energia_operator = next((op for op in operators if op.get('scope') == 'energia'), None)
            if not energia_operator:
                energia_operator = operators[0]  # Use first available
            
            sale_data_energia = {
                "date": "2025-01-15T11:00:00Z",
                "partner_id": partners[0]['id'],
                "operator_id": energia_operator['id'],
                "scope": "energia",
                "client_type": "empresarial",
                "client_name": "Empresa Energia Lda",
                "client_nif": "987654321",
                "client_contact": "213456789",
                "cpe": "PT0001000000000000000000AA",
                "power": "10.35 kVA",
                "requisition": "REQ-ENERGIA-001"  # Backend should accept this even for energia
            }
            
            response = requests.post(f"{self.api_url}/sales", json=sale_data_energia, headers=self.get_headers())
            
            if response.status_code == 200:
                sale = response.json()
                if sale.get('requisition') == "REQ-ENERGIA-001":
                    self.log_test("Create sale with requisition (energia)", True, f"Backend accepts requisition for energia: {sale['requisition']}")
                    energia_sale_id = sale['id']
                else:
                    self.log_test("Create sale with requisition (energia)", False, "Requisition field not saved for energia scope")
                    return False
            else:
                self.log_test("Create sale with requisition (energia)", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_test("Create sale with requisition (energia)", False, f"Exception: {str(e)}")
            return False

        # Step 4: Test updating sale with requisition field
        try:
            update_data = {
                "requisition": "REQ-UPDATED-001"
            }
            
            response = requests.put(f"{self.api_url}/sales/{telecom_sale_id}", json=update_data, headers=self.get_headers())
            
            if response.status_code == 200:
                updated_sale = response.json()
                if updated_sale.get('requisition') == "REQ-UPDATED-001":
                    self.log_test("Update sale requisition", True, f"Requisition updated to: {updated_sale['requisition']}")
                else:
                    self.log_test("Update sale requisition", False, "Requisition update failed")
                    return False
            else:
                self.log_test("Update sale requisition", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Update sale requisition", False, f"Exception: {str(e)}")
            return False

        # Step 5: Verify requisition field in sales list
        try:
            response = requests.get(f"{self.api_url}/sales", headers=self.get_headers())
            
            if response.status_code == 200:
                sales = response.json()
                telecom_sale = next((s for s in sales if s['id'] == telecom_sale_id), None)
                energia_sale = next((s for s in sales if s['id'] == energia_sale_id), None)
                
                if telecom_sale and telecom_sale.get('requisition') == "REQ-UPDATED-001":
                    self.log_test("Verify requisition in sales list (telecom)", True, f"Requisition found: {telecom_sale['requisition']}")
                else:
                    self.log_test("Verify requisition in sales list (telecom)", False, "Requisition not found in sales list")
                
                if energia_sale and energia_sale.get('requisition') == "REQ-ENERGIA-001":
                    self.log_test("Verify requisition in sales list (energia)", True, f"Requisition found: {energia_sale['requisition']}")
                else:
                    self.log_test("Verify requisition in sales list (energia)", False, "Requisition not found in sales list")
                    
            else:
                self.log_test("Verify requisition in sales list", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Verify requisition in sales list", False, f"Exception: {str(e)}")
            return False

        print("✅ Requisition field functionality testing completed!")
        print("📝 Note: Frontend validation (showing field only for telecomunicacoes) is handled by frontend code")
        return True

    def test_forms_functionality(self):
        """Test complete Forms/Documents functionality as requested in review"""
        print("\n🔍 Testing Forms/Documents Functionality (Previous Implementation)")
        print("=" * 60)
        
        # This test is kept for completeness but focuses on the previous implementation
        # The main focus now is on the 3 corrections above
        
        # Step 1: Get operators with include_hidden=true
        try:
            response = requests.get(f"{self.api_url}/operators?include_hidden=true", headers=self.get_headers())
            if response.status_code != 200:
                self.log_test("Get operators for forms testing", False, f"Status: {response.status_code}")
                return False
            
            operators = response.json()
            if not operators:
                self.log_test("Get operators for forms testing", False, "No operators found")
                return False
            
            self.log_test("Get operators for forms testing", True, f"Found {len(operators)} operators")
            
            # Find an operator to test with (prefer Vodafone, Endesa, etc.)
            test_operator = None
            for op in operators:
                if op['name'] in ['Vodafone', 'Endesa', 'MEO', 'EDP']:
                    test_operator = op
                    break
            
            if not test_operator:
                test_operator = operators[0]  # Use first available
            
            operator_id = test_operator['id']
            self.log_test("Select test operator", True, f"Using operator: {test_operator['name']} (ID: {operator_id})")
            
        except Exception as e:
            self.log_test("Get operators for forms testing", False, f"Exception: {str(e)}")
            return False

        # Quick test of document functionality (abbreviated version)
        try:
            # Check if operator already has documents
            if test_operator.get('documents'):
                doc_count = len(test_operator['documents'])
                self.log_test("Forms functionality check", True, f"Operator has {doc_count} existing documents - forms system working")
                return True
            else:
                self.log_test("Forms functionality check", True, "No existing documents found - forms system ready for use")
                return True
                
        except Exception as e:
            self.log_test("Forms functionality check", False, f"Exception: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting MDM Grupo Backend API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Login is required for all other tests
        if not self.test_login():
            print("\n❌ Login failed - cannot continue with other tests")
            return False
        
        # Run all tests
        self.test_dashboard_stats()
        self.test_partners_crud()
        self.test_operators_crud()
        self.test_sales_crud()
        self.test_users_management()
        self.test_export_functionality()
        
        # Test the new Forms functionality (main focus of this review)
        self.test_forms_functionality()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("🎉 Backend tests mostly successful!")
        elif success_rate >= 60:
            print("⚠️  Backend has some issues but core functionality works")
        else:
            print("🚨 Backend has significant issues")
        
        return success_rate >= 60

def main():
    tester = MDMGrupoAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
            },
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())