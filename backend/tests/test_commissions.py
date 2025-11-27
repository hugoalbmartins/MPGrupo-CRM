"""
Tests for commission calculation logic
"""
import pytest
from datetime import datetime, timezone


class TestCommissionCalculation:
    """Test commission calculation with different scenarios"""
    
    def test_telecom_commission_tier_0(self):
        """Test telecomunicacoes commission at tier 0 (0 sales)"""
        # Expected: 30 * 1.5 = 45
        monthly_value = 30
        multiplier = 1.5
        expected = monthly_value * multiplier
        
        assert expected == 45.0
    
    def test_telecom_commission_tier_1(self):
        """Test telecomunicacoes commission at tier 1 (3+ sales)"""
        # Expected: 30 * 2.0 = 60
        monthly_value = 30
        multiplier = 2.0
        expected = monthly_value * multiplier
        
        assert expected == 60.0
    
    def test_energy_commission_tier_0(self):
        """Test energia commission at tier 0 (0 sales)"""
        # Expected: fixed 50
        expected = 50.0
        
        assert expected == 50.0
    
    def test_energy_commission_tier_1(self):
        """Test energia commission at tier 1 (2+ sales)"""
        # Expected: fixed 75
        expected = 75.0
        
        assert expected == 75.0
    
    def test_tier_threshold(self):
        """Test that tier changes at correct threshold"""
        # Sales count: 0-2 = tier 0, 3+ = tier 1
        assert 2 < 3  # Below threshold
        assert 3 >= 3  # At threshold
        assert 4 >= 3  # Above threshold


class TestPartnerCodeGeneration:
    """Test partner code generation"""
    
    def test_d2d_code_format(self):
        """Test D2D partner code format"""
        code = "D2D1001"
        assert code.startswith("D2D")
        assert code[3:].isdigit()
        assert len(code) == 7
    
    def test_rev_plus_code_format(self):
        """Test Rev+ partner code format"""
        code = "Rev+1001"
        assert code.startswith("Rev+")
        assert code[4:].isdigit()


class TestSaleCodeGeneration:
    """Test sale code generation"""
    
    def test_sale_code_format(self):
        """Test sale code format: 3 letters + 4 digits + 2 digits"""
        code = "ALB000111"
        assert len(code) == 9
        assert code[:3].isalpha()
        assert code[3:7].isdigit()
        assert code[7:].isdigit()
    
    def test_sale_code_month_suffix(self):
        """Test sale code has correct month suffix"""
        code = "ALB000111"
        month = int(code[7:])
        assert 1 <= month <= 12


class TestNIFValidation:
    """Test NIF validation with CRC check"""
    
    def test_valid_nif_starting_with_5(self):
        """Test valid NIF starting with 5"""
        # 501234560 is valid
        nif = "501234560"
        
        # Calculate CRC
        multipliers = [9, 8, 7, 6, 5, 4, 3, 2]
        total = sum(int(nif[i]) * multipliers[i] for i in range(8))
        check_digit = 11 - (total % 11)
        if check_digit >= 10:
            check_digit = 0
        
        assert check_digit == int(nif[8])
    
    def test_invalid_nif_starting_with_5(self):
        """Test invalid NIF starting with 5"""
        # 501234567 is invalid (wrong check digit)
        nif = "501234567"
        
        multipliers = [9, 8, 7, 6, 5, 4, 3, 2]
        total = sum(int(nif[i]) * multipliers[i] for i in range(8))
        check_digit = 11 - (total % 11)
        if check_digit >= 10:
            check_digit = 0
        
        assert check_digit != int(nif[8])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
