#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class MDMGrupoAPITester:
    def __init__(self, base_url="https://partner-sales-hub.preview.emergentagent.com"):
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
                "password": "12345Hm"
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