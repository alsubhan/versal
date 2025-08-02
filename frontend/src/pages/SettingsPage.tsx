
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { currencies } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currencyStore";
import { FileJson, Files, Upload, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock } from "lucide-react";
import { getSystemSettings, createSystemSetting, updateSystemSetting } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";

const SettingsPage = () => {
  const { currency, setCurrency } = useCurrencyStore();
  const { hasPermission, loading: authLoading, permissions } = useAuth();
  const canViewSettings = hasPermission('settings_view');
  const canEditSettings = hasPermission('settings_edit');
  const [systemSettings, setSystemSettings] = useState<Array<{
    id: string;
    key: string;
    value: string | number | boolean;
    type: string;
    description?: string;
    isPublic: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
  const [originalFormData, setOriginalFormData] = useState<typeof formData | null>(null);
  const [formData, setFormData] = useState({
    // Company Information
    companyName: '',
    companyAddress: '',
    companyCity: '',
    companyState: '',
    companyZip: '',
    companyCountry: '',
    companyPhone: '',
    companyEmail: '',
    
    // Application Settings
    defaultCurrency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12',
    timezone: 'UTC',
    language: 'en',
    
    // Invoice Settings
    taxRate: '10.0',
    invoicePrefix: 'INV',
    creditNotePrefix: 'CN',
    purchaseOrderPrefix: 'PO',
    grnPrefix: 'GRN',
    invoiceNumberReset: 'never',
    invoiceFormatTemplate: 'standard',
    roundingMethod: 'no_rounding',
    roundingPrecision: '0.01',
    defaultInvoiceNotes: 'Thank you for your business',
    includeCompanyLogo: true,
    
    // System Settings
    lowStockThreshold: '10',
    autoReorderEnabled: false,
    emailNotificationsEnabled: true,
    backupFrequency: 'daily',
    sessionTimeout: '3600',
    taxCalculationMethod: 'exclusive',
    autoBackupEnabled: true,
    lowStockGlobalThreshold: '10',
    enableMultiWarehouse: false,
    grnAutoNumbering: true,
    poAutoNumbering: true,
    invoiceAutoNumbering: true,
    
    // Security Settings
    enableSignup: true,
    requireEmailVerification: true,
    maxLoginAttempts: '5',
    lockoutDuration: '300',
    passwordMinLength: '8',
    passwordRequireSpecial: true,
    sessionTimeoutWarning: '300',
    enableAuditLog: true,
    enableApiRateLimiting: true,
    enableTwoFactorAuth: false,
    enableRememberMe: true,
    enablePasswordReset: true,
    enableAccountLockout: true,
    
    // File Upload Settings
    maxFileUploadSize: '10485760',
    allowedFileTypes: 'jpg,jpeg,png,pdf,doc,docx,xls,xlsx',
    
    // Backup Settings
    backupRetentionDays: '30'
  });

  // Fetch system settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSystemSettings();
        setSystemSettings(data);
        
        // Parse address into components
        const parseAddress = (address: string) => {
          // Example: "123 Business Street, Tech City, TC 12345, USA"
          const parts = address.split(',').map(part => part.trim());
          if (parts.length >= 4) {
            return {
              street: parts[0],
              city: parts[1],
              stateZip: parts[2],
              country: parts[3]
            };
          }
          return { street: address, city: '', stateZip: '', country: '' };
        };
        
        // Parse address components
        const address = data.find(s => s.key === 'company_address')?.value || '';
        const addressParts = parseAddress(address);
        const stateZipParts = addressParts.stateZip.split(' ');
        const state = stateZipParts[0] || '';
        const zip = stateZipParts.slice(1).join(' ') || '';
        
        // Helper function to get setting value with proper type conversion
        const getSettingValue = (key: string, defaultValue: string | number | boolean = '') => {
          const setting = data.find(s => s.key === key);
          return setting ? setting.value : defaultValue;
        };

        const getStringValue = (key: string, defaultValue: string = '') => {
          const value = getSettingValue(key, defaultValue);
          return typeof value === 'string' ? value : String(value);
        };

        const getBooleanValue = (key: string, defaultValue: boolean = false) => {
          const value = getSettingValue(key, defaultValue);
          return typeof value === 'boolean' ? value : Boolean(value);
        };
        
        // Update form data with fetched settings using proper type conversion
        const newFormData = {
          // Company Information
          companyName: getStringValue('company_name', ''),
          companyAddress: address,
          companyCity: getStringValue('company_city', addressParts.city),
          companyState: getStringValue('company_state', state),
          companyZip: getStringValue('company_zip', zip),
          companyCountry: getStringValue('company_country', addressParts.country),
          companyPhone: getStringValue('company_phone', ''),
          companyEmail: getStringValue('company_email', ''),
          
          // Application Settings
          defaultCurrency: getStringValue('default_currency', 'USD'),
          dateFormat: getStringValue('date_format', 'MM/DD/YYYY'),
          timeFormat: getStringValue('time_format', '12'),
          timezone: getStringValue('timezone', 'UTC'),
          language: getStringValue('language', 'en'),
          
          // Invoice Settings
          taxRate: getStringValue('tax_rate', '10.0'),
          invoicePrefix: getStringValue('invoice_prefix', 'INV'),
          creditNotePrefix: getStringValue('credit_note_prefix', 'CN'),
          purchaseOrderPrefix: getStringValue('purchase_order_prefix', 'PO'),
          grnPrefix: getStringValue('grn_prefix', 'GRN'),
          invoiceNumberReset: getStringValue('invoice_number_reset', 'never'),
          invoiceFormatTemplate: getStringValue('invoice_format_template', 'standard'),
          roundingMethod: getStringValue('rounding_method', 'no_rounding'),
          roundingPrecision: getStringValue('rounding_precision', '0.01'),
          defaultInvoiceNotes: getStringValue('default_invoice_notes', 'Thank you for your business'),
          includeCompanyLogo: getBooleanValue('include_company_logo', true),
          
          // System Settings
          lowStockThreshold: getStringValue('low_stock_threshold', '10'),
          autoReorderEnabled: getBooleanValue('auto_reorder_enabled', false),
          emailNotificationsEnabled: getBooleanValue('email_notifications_enabled', true),
          backupFrequency: getStringValue('backup_frequency', 'daily'),
          sessionTimeout: getStringValue('session_timeout', '3600'),
          taxCalculationMethod: getStringValue('tax_calculation_method', 'exclusive'),
          autoBackupEnabled: getBooleanValue('auto_backup_enabled', true),
          lowStockGlobalThreshold: getStringValue('low_stock_global_threshold', '10'),
          enableMultiWarehouse: getBooleanValue('enable_multi_warehouse', false),
          grnAutoNumbering: getBooleanValue('grn_auto_numbering', true),
          poAutoNumbering: getBooleanValue('po_auto_numbering', true),
          invoiceAutoNumbering: getBooleanValue('invoice_auto_numbering', true),
          
          // Security Settings
          enableSignup: getBooleanValue('enable_signup', true),
          requireEmailVerification: getBooleanValue('require_email_verification', true),
          maxLoginAttempts: getStringValue('max_login_attempts', '5'),
          lockoutDuration: getStringValue('lockout_duration', '300'),
          passwordMinLength: getStringValue('password_min_length', '8'),
          passwordRequireSpecial: getBooleanValue('password_require_special', true),
          sessionTimeoutWarning: getStringValue('session_timeout_warning', '300'),
          enableAuditLog: getBooleanValue('enable_audit_log', true),
          enableApiRateLimiting: getBooleanValue('enable_api_rate_limiting', true),
          enableTwoFactorAuth: getBooleanValue('enable_two_factor_auth', false),
          enableRememberMe: getBooleanValue('enable_remember_me', true),
          enablePasswordReset: getBooleanValue('enable_password_reset', true),
          enableAccountLockout: getBooleanValue('enable_account_lockout', true),
          
          // File Upload Settings
          maxFileUploadSize: getStringValue('max_file_upload_size', '10485760'),
          allowedFileTypes: getStringValue('allowed_file_types', 'jpg,jpeg,png,pdf,doc,docx,xls,xlsx'),
          
          // Backup Settings
          backupRetentionDays: getStringValue('backup_retention_days', '30')
        };
        
        setFormData(newFormData);
        setOriginalFormData(newFormData); // Store initial form data
      } catch (error) {
        console.error('Error fetching system settings:', error);
        toast.error('Failed to fetch system settings');
      } finally {
        setLoading(false);
      }
    };

    if (canViewSettings) {
      fetchSettings();
    } else {
      // If user doesn't have permission, stop loading immediately
      setLoading(false);
    }
  }, [canViewSettings]); // Only depend on canViewSettings

  // Show loading spinner during auth/permission check OR data loading
  if (authLoading || permissions.length === 0 || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user doesn't have permission to view settings, show access denied
  if (!canViewSettings) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view settings. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Track if this field has been modified from its original value
    if (originalFormData && originalFormData[field] !== value) {
      setModifiedFields(prev => new Set(prev).add(field));
    } else if (originalFormData && originalFormData[field] === value) {
      setModifiedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(field);
        return newSet;
      });
    }
  };

  const handleCurrencyChange = (value: string) => {
    if (!canEditSettings) {
      toast.error("You do not have permission to edit settings.");
      return;
    }
    
    // Just update local state, don't save to backend immediately
    setCurrency(value);
    handleInputChange('defaultCurrency', value);
  };

  const handleResetChanges = () => {
    if (originalFormData) {
      setFormData(originalFormData);
      setModifiedFields(new Set());
      toast.info("Changes reset to original values");
    }
  };

  const handleSaveChanges = async () => {
    if (!canEditSettings) {
      toast.error("You do not have permission to edit settings.");
      return;
    }

    if (modifiedFields.size === 0) {
      toast.info("No changes to save");
      return;
    }

    try {
      // Define which settings should be public (accessible without authentication)
      const publicSettings = [
        'enable_signup',
        'company_name',
        'default_currency',
        'date_format',
        'timezone',
        'language'
      ];

      // Create a mapping of form field names to setting keys
      const formToSettingMap = {
        // Company Information
        companyName: 'company_name',
        companyAddress: 'company_address',
        companyCity: 'company_city',
        companyState: 'company_state',
        companyZip: 'company_zip',
        companyCountry: 'company_country',
        companyPhone: 'company_phone',
        companyEmail: 'company_email',
        
        // Application Settings
        defaultCurrency: 'default_currency',
        dateFormat: 'date_format',
        timeFormat: 'time_format',
        timezone: 'timezone',
        language: 'language',
        
        // Invoice Settings
        taxRate: 'tax_rate',
        invoicePrefix: 'invoice_prefix',
        creditNotePrefix: 'credit_note_prefix',
        purchaseOrderPrefix: 'purchase_order_prefix',
        grnPrefix: 'grn_prefix',
        invoiceNumberReset: 'invoice_number_reset',
        invoiceFormatTemplate: 'invoice_format_template',
        roundingMethod: 'rounding_method',
        roundingPrecision: 'rounding_precision',
        defaultInvoiceNotes: 'default_invoice_notes',
        includeCompanyLogo: 'include_company_logo',
        
        // System Settings
        lowStockThreshold: 'low_stock_threshold',
        autoReorderEnabled: 'auto_reorder_enabled',
        emailNotificationsEnabled: 'email_notifications_enabled',
        backupFrequency: 'backup_frequency',
        sessionTimeout: 'session_timeout',
        taxCalculationMethod: 'tax_calculation_method',
        autoBackupEnabled: 'auto_backup_enabled',
        lowStockGlobalThreshold: 'low_stock_global_threshold',
        enableMultiWarehouse: 'enable_multi_warehouse',
        grnAutoNumbering: 'grn_auto_numbering',
        poAutoNumbering: 'po_auto_numbering',
        invoiceAutoNumbering: 'invoice_auto_numbering',
        
        // Security Settings
        enableSignup: 'enable_signup',
        requireEmailVerification: 'require_email_verification',
        maxLoginAttempts: 'max_login_attempts',
        lockoutDuration: 'lockout_duration',
        passwordMinLength: 'password_min_length',
        passwordRequireSpecial: 'password_require_special',
        sessionTimeoutWarning: 'session_timeout_warning',
        enableAuditLog: 'enable_audit_log',
        enableApiRateLimiting: 'enable_api_rate_limiting',
        enableTwoFactorAuth: 'enable_two_factor_auth',
        enableRememberMe: 'enable_remember_me',
        enablePasswordReset: 'enable_password_reset',
        enableAccountLockout: 'enable_account_lockout',
        
        // File Upload Settings
        maxFileUploadSize: 'max_file_upload_size',
        allowedFileTypes: 'allowed_file_types',
        
        // Backup Settings
        backupRetentionDays: 'backup_retention_days'
      };

      // Track which settings were actually changed
      const changedSettings = [];
      const updatePromises = systemSettings.map(async (setting) => {
        const settingKey = setting.key;
        const formField = Object.keys(formToSettingMap).find(key => formToSettingMap[key as keyof typeof formToSettingMap] === settingKey);
        
        if (formField && formData[formField as keyof typeof formData] !== undefined) {
          const newValue = formData[formField as keyof typeof formData];
          const originalValue = setting.value;
          
          // Only update if the value has actually changed
          if (newValue !== originalValue) {
            changedSettings.push(settingKey);
            
            // Determine if this setting should be public
            const isPublic = publicSettings.includes(settingKey);
            
            return updateSystemSetting(setting.id, {
              key: setting.key,
              value: newValue,
              type: setting.type || 'string',
              description: setting.description,
              isPublic: isPublic
            });
          }
        }
      });

      const results = await Promise.all(updatePromises.filter(Boolean));
      
      if (changedSettings.length > 0) {
        toast.success(`${changedSettings.length} setting(s) saved successfully`);
        console.log('Changed settings:', changedSettings);
        
        // Clear modified fields after successful save
        setModifiedFields(new Set());
        
        // Update original form data to reflect the new saved state
        setOriginalFormData({ ...formData });
      } else {
        toast.info("No changes to save");
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const handleFileImport = (type: 'csv' | 'json') => {
    if (!canEditSettings) {
      toast.error("You do not have permission to perform this action.");
      return;
    }
    // This would handle file imports in a real application
    toast.info(`${type.toUpperCase()} import initiated`);
  };

  const isFieldModified = (fieldName: string) => {
    return modifiedFields.has(fieldName);
  };

  const getFieldClassName = (fieldName: string) => {
    return isFieldModified(fieldName) ? "border-orange-300 bg-orange-50 dark:bg-orange-950/20" : "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        
        {/* Common Save/Revert Buttons */}
        <div className="flex items-center space-x-2">
          {modifiedFields.size > 0 && (
            <Button 
              variant="outline" 
              onClick={handleResetChanges}
              disabled={!canEditSettings}
            >
              Revert Changes
            </Button>
          )}
          <Button 
            onClick={handleSaveChanges} 
            disabled={!canEditSettings || modifiedFields.size === 0}
          >
            Save Changes {modifiedFields.size > 0 && `(${modifiedFields.size})`}
          </Button>
        </div>
      </div>
        
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          {/* Company Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Update your company details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input 
                    id="companyName" 
                    value={formData.companyName} 
                    onChange={(e) => handleInputChange('companyName', e.target.value)} 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyName')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email Address</Label>
                  <Input 
                    id="companyEmail" 
                    type="email" 
                    value={formData.companyEmail} 
                    onChange={(e) => handleInputChange('companyEmail', e.target.value)} 
                    placeholder="contact@versal.com" 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyEmail')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Phone Number</Label>
                  <Input 
                    id="companyPhone" 
                    value={formData.companyPhone} 
                    onChange={(e) => handleInputChange('companyPhone', e.target.value)} 
                    placeholder="+1 (555) 000-0000" 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyPhone')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Street Address</Label>
                  <Input 
                    id="companyAddress" 
                    value={formData.companyAddress} 
                    onChange={(e) => handleInputChange('companyAddress', e.target.value)} 
                    placeholder="123 Business St." 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyAddress')}
                  />
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                  <Label htmlFor="companyCity">City</Label>
                  <Input 
                    id="companyCity" 
                    value={formData.companyCity} 
                    onChange={(e) => handleInputChange('companyCity', e.target.value)} 
                    placeholder="New York" 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyCity')}
                  />
              </div>
                <div className="space-y-2">
                  <Label htmlFor="companyState">State / Province</Label>
                  <Input 
                    id="companyState" 
                    value={formData.companyState} 
                    onChange={(e) => handleInputChange('companyState', e.target.value)} 
                    placeholder="NY" 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyState')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyZip">Zip / Postal Code</Label>
                  <Input 
                    id="companyZip" 
                    value={formData.companyZip} 
                    onChange={(e) => handleInputChange('companyZip', e.target.value)} 
                    placeholder="10001" 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyZip')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCountry">Country</Label>
                  <Input 
                    id="companyCountry" 
                    value={formData.companyCountry} 
                    onChange={(e) => handleInputChange('companyCountry', e.target.value)} 
                    placeholder="USA" 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('companyCountry')}
                  />
                </div>
              </div>
              
            </CardContent>
          </Card>
          
          {/* Application Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>
                Configure general application preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={formData.dateFormat} onValueChange={(value) => handleInputChange('dateFormat', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time Format</Label>
                  <Select value={formData.timeFormat} onValueChange={(value) => handleInputChange('timeFormat', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12-hour</SelectItem>
                      <SelectItem value="24">24-hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input 
                    id="timezone" 
                    value={formData.timezone} 
                    onChange={(e) => handleInputChange('timezone', e.target.value)} 
                    placeholder="UTC" 
                    disabled={!canEditSettings} 
                    className={getFieldClassName('timezone')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={formData.language} onValueChange={(value) => handleInputChange('language', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="currency">Currency</Label>
                  <p className="text-sm text-muted-foreground">Choose your preferred currency</p>
                </div>
                <Select value={formData.defaultCurrency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.symbol} - {curr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
            </CardContent>
          </Card>
        
          {/* Invoice Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
              <CardDescription>
                Customize your invoice templates and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
                  <Input 
                    id="invoicePrefix" 
                    value={formData.invoicePrefix} 
                    onChange={(e) => handleInputChange('invoicePrefix', e.target.value)} 
                    placeholder="INV-" 
                    disabled={!canEditSettings}
                    className={getFieldClassName('invoicePrefix')}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="creditNotePrefix">Credit Note Prefix</Label>
                  <Input 
                    id="creditNotePrefix" 
                    value={formData.creditNotePrefix} 
                    onChange={(e) => handleInputChange('creditNotePrefix', e.target.value)} 
                    placeholder="CN-" 
                    disabled={!canEditSettings}
                    className={getFieldClassName('creditNotePrefix')}
                  />
                    </div>

                <div className="space-y-2">
                  <Label htmlFor="purchaseOrderPrefix">Purchase Order Prefix</Label>
                  <Input 
                    id="purchaseOrderPrefix" 
                    value={formData.purchaseOrderPrefix} 
                    onChange={(e) => handleInputChange('purchaseOrderPrefix', e.target.value)} 
                    placeholder="PO-" 
                    disabled={!canEditSettings}
                    className={getFieldClassName('purchaseOrderPrefix')}
                  />
                    </div>

                <div className="space-y-2">
                  <Label htmlFor="grnPrefix">GRN Prefix</Label>
                  <Input 
                    id="grnPrefix" 
                    value={formData.grnPrefix} 
                    onChange={(e) => handleInputChange('grnPrefix', e.target.value)} 
                    placeholder="GRN-" 
                    disabled={!canEditSettings}
                    className={getFieldClassName('grnPrefix')}
                  />
                    </div>

                <div className="space-y-2">
                  <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
                  <Input 
                    id="taxRate" 
                    type="number"
                    value={formData.taxRate} 
                    onChange={(e) => handleInputChange('taxRate', e.target.value)} 
                    placeholder="10.0" 
                    disabled={!canEditSettings}
                    className={getFieldClassName('taxRate')}
                  />
                    </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceNumberReset">Invoice Number Reset</Label>
                  <Select value={formData.invoiceNumberReset} onValueChange={(value) => handleInputChange('invoiceNumberReset', value)}>
                    <SelectTrigger className={getFieldClassName('invoiceNumberReset')}>
                      <SelectValue placeholder="Select reset frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Never reset</SelectItem>
                      <SelectItem value="monthly">Reset monthly</SelectItem>
                      <SelectItem value="fiscal_year">Reset every fiscal year</SelectItem>
                      <SelectItem value="annually">Reset annually (calendar year)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceFormatTemplate">Invoice Format Template</Label>
                  <Select value={formData.invoiceFormatTemplate} onValueChange={(value) => handleInputChange('invoiceFormatTemplate', value)}>
                    <SelectTrigger className={getFieldClassName('invoiceFormatTemplate')}>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard Template</SelectItem>
                      <SelectItem value="custom_basic">Custom Template (Basic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="roundingMethod">Rounding Method</Label>
                  <Select value={formData.roundingMethod} onValueChange={(value) => handleInputChange('roundingMethod', value)}>
                    <SelectTrigger className={getFieldClassName('roundingMethod')}>
                      <SelectValue placeholder="Select rounding method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_rounding">No rounding</SelectItem>
                      <SelectItem value="nearest">Round to nearest</SelectItem>
                      <SelectItem value="up">Round up</SelectItem>
                      <SelectItem value="down">Round down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="roundingPrecision">Rounding Precision</Label>
                  <Select value={formData.roundingPrecision} onValueChange={(value) => handleInputChange('roundingPrecision', value)}>
                    <SelectTrigger className={getFieldClassName('roundingPrecision')}>
                      <SelectValue placeholder="Select precision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.01">0.01 (Cents/Paise)</SelectItem>
                      <SelectItem value="0.25">0.25 (Quarter rounding)</SelectItem>
                      <SelectItem value="0.50">0.50 (Half unit rounding)</SelectItem>
                      <SelectItem value="1.00">1.00 (Whole unit rounding)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultInvoiceNotes">Default Invoice Notes</Label>
                <Input 
                  id="defaultInvoiceNotes" 
                  value={formData.defaultInvoiceNotes} 
                  onChange={(e) => handleInputChange('defaultInvoiceNotes', e.target.value)} 
                  placeholder="Thank you for your business" 
                  disabled={!canEditSettings}
                  className={getFieldClassName('defaultInvoiceNotes')}
                />
              </div>
              
              <div className="space-y-3">
                <Label>Auto Numbering</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.invoiceAutoNumbering} 
                      onCheckedChange={(checked) => handleInputChange('invoiceAutoNumbering', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('invoiceAutoNumbering')}
                    />
                    <Label className="text-sm">Auto-generate Invoice numbers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.poAutoNumbering} 
                      onCheckedChange={(checked) => handleInputChange('poAutoNumbering', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('poAutoNumbering')}
                    />
                    <Label className="text-sm">Auto-generate Purchase Order numbers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.grnAutoNumbering} 
                      onCheckedChange={(checked) => handleInputChange('grnAutoNumbering', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('grnAutoNumbering')}
                    />
                    <Label className="text-sm">Auto-generate GRN numbers</Label>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  checked={formData.includeCompanyLogo} 
                  onCheckedChange={(checked) => handleInputChange('includeCompanyLogo', checked)}
                  disabled={!canEditSettings}
                  className={getFieldClassName('includeCompanyLogo')}
                />
                <Label>Include company logo on invoices</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure authentication and security preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">User Registration</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enableSignup} 
                      onCheckedChange={(checked) => handleInputChange('enableSignup', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enableSignup')}
                    />
                    <Label>Enable user signup</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.requireEmailVerification} 
                      onCheckedChange={(checked) => handleInputChange('requireEmailVerification', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('requireEmailVerification')}
                    />
                    <Label>Require email verification</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Password Policy</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="passwordMinLength">Minimum Password Length</Label>
                    <Input 
                      id="passwordMinLength" 
                      type="number"
                      value={formData.passwordMinLength} 
                      onChange={(e) => handleInputChange('passwordMinLength', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('passwordMinLength')}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.passwordRequireSpecial} 
                      onCheckedChange={(checked) => handleInputChange('passwordRequireSpecial', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('passwordRequireSpecial')}
                    />
                    <Label>Require special characters</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Login Security</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                    <Input 
                      id="maxLoginAttempts" 
                      type="number"
                      value={formData.maxLoginAttempts} 
                      onChange={(e) => handleInputChange('maxLoginAttempts', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('maxLoginAttempts')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lockoutDuration">Lockout Duration (seconds)</Label>
                    <Input 
                      id="lockoutDuration" 
                      type="number"
                      value={formData.lockoutDuration} 
                      onChange={(e) => handleInputChange('lockoutDuration', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('lockoutDuration')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enableAccountLockout} 
                      onCheckedChange={(checked) => handleInputChange('enableAccountLockout', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enableAccountLockout')}
                    />
                    <Label>Enable account lockout</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enableRememberMe} 
                      onCheckedChange={(checked) => handleInputChange('enableRememberMe', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enableRememberMe')}
                    />
                    <Label>Enable remember me</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enablePasswordReset} 
                      onCheckedChange={(checked) => handleInputChange('enablePasswordReset', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enablePasswordReset')}
                    />
                    <Label>Enable password reset</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enableTwoFactorAuth} 
                      onCheckedChange={(checked) => handleInputChange('enableTwoFactorAuth', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enableTwoFactorAuth')}
                    />
                    <Label>Enable two-factor authentication</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Session Management</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Session Timeout (seconds)</Label>
                    <Input 
                      id="sessionTimeout" 
                      type="number"
                      value={formData.sessionTimeout} 
                      onChange={(e) => handleInputChange('sessionTimeout', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('sessionTimeout')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeoutWarning">Timeout Warning (seconds)</Label>
                    <Input 
                      id="sessionTimeoutWarning" 
                      type="number"
                      value={formData.sessionTimeoutWarning} 
                      onChange={(e) => handleInputChange('sessionTimeoutWarning', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('sessionTimeoutWarning')}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">API Access</h3>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>API Access Keys</Label>
                    <p className="text-sm text-muted-foreground">
                      Manage API keys for external integrations
                    </p>
                  </div>
                  <Button variant="outline" disabled={!canEditSettings}>
                    Manage API Keys
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure system behavior and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">Notifications</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.emailNotificationsEnabled} 
                      onCheckedChange={(checked) => handleInputChange('emailNotificationsEnabled', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('emailNotificationsEnabled')}
                    />
                    <Label>Email notifications</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Inventory Management</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                    <Input 
                      id="lowStockThreshold" 
                      type="number"
                      value={formData.lowStockThreshold} 
                      onChange={(e) => handleInputChange('lowStockThreshold', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('lowStockThreshold')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockGlobalThreshold">Global Low Stock Threshold (%)</Label>
                    <Input 
                      id="lowStockGlobalThreshold" 
                      type="number"
                      value={formData.lowStockGlobalThreshold} 
                      onChange={(e) => handleInputChange('lowStockGlobalThreshold', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('lowStockGlobalThreshold')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.autoReorderEnabled} 
                      onCheckedChange={(checked) => handleInputChange('autoReorderEnabled', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('autoReorderEnabled')}
                    />
                    <Label>Auto reorder enabled</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enableMultiWarehouse} 
                      onCheckedChange={(checked) => handleInputChange('enableMultiWarehouse', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enableMultiWarehouse')}
                    />
                    <Label>Enable multi-warehouse</Label>
                  </div>
                </div>
                </div>
                
              <div className="space-y-4">
                <h3 className="font-medium">Backup & Maintenance</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="backupFrequency">Backup Frequency</Label>
                    <Select value={formData.backupFrequency} onValueChange={(value) => handleInputChange('backupFrequency', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backupRetentionDays">Backup Retention (days)</Label>
                    <Input 
                      id="backupRetentionDays" 
                      type="number"
                      value={formData.backupRetentionDays} 
                      onChange={(e) => handleInputChange('backupRetentionDays', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('backupRetentionDays')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.autoBackupEnabled} 
                      onCheckedChange={(checked) => handleInputChange('autoBackupEnabled', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('autoBackupEnabled')}
                    />
                    <Label>Auto backup enabled</Label>
                  </div>
                </div>
                </div>
                
              <div className="space-y-4">
                <h3 className="font-medium">API & Security</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enableApiRateLimiting} 
                      onCheckedChange={(checked) => handleInputChange('enableApiRateLimiting', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enableApiRateLimiting')}
                    />
                    <Label>Enable API rate limiting</Label>
                  </div>
                <div className="flex items-center space-x-2">
                    <Switch 
                      checked={formData.enableAuditLog} 
                      onCheckedChange={(checked) => handleInputChange('enableAuditLog', checked)}
                      disabled={!canEditSettings}
                      className={getFieldClassName('enableAuditLog')}
                    />
                    <Label>Enable audit logging</Label>
                  </div>
                </div>
              </div>
              
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure advanced system settings and file uploads
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">File Upload Settings</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maxFileUploadSize">Max File Size (bytes)</Label>
                    <Input 
                      id="maxFileUploadSize" 
                      type="number"
                      value={formData.maxFileUploadSize} 
                      onChange={(e) => handleInputChange('maxFileUploadSize', e.target.value)} 
                      disabled={!canEditSettings}
                      className={getFieldClassName('maxFileUploadSize')}
                    />
                  </div>
                <div className="space-y-2">
                    <Label htmlFor="allowedFileTypes">Allowed File Types</Label>
                    <Input 
                      id="allowedFileTypes" 
                      value={formData.allowedFileTypes} 
                      onChange={(e) => handleInputChange('allowedFileTypes', e.target.value)} 
                      placeholder="jpg,jpeg,png,pdf" 
                      disabled={!canEditSettings}
                      className={getFieldClassName('allowedFileTypes')}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                  <h3 className="font-medium">Data Import</h3>
                <p className="text-sm text-muted-foreground">Import data from CSV or JSON files</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => handleFileImport('csv')}
                      className="flex items-center gap-2"
                    disabled={!canEditSettings}
                    >
                      <Files size={16} />
                      Import CSV
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleFileImport('json')}
                      className="flex items-center gap-2"
                    disabled={!canEditSettings}
                    >
                      <FileJson size={16} />
                      Import JSON
                    </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Data Export</Label>
                  <p className="text-sm text-muted-foreground">Export all data as CSV or JSON</p>
                </div>
                <Button variant="outline" disabled={!canEditSettings}>Export Data</Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Clear Cache</Label>
                  <p className="text-sm text-muted-foreground">Clear application cache data</p>
                </div>
                <Button variant="outline" disabled={!canEditSettings}>Clear Cache</Button>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground">
                    These actions are permanent and cannot be undone
                  </p>
                  <div className="flex space-x-2">
                    <Button variant="destructive" disabled={!canEditSettings}>Reset All Settings</Button>
                    <Button variant="outline" className="text-red-600" disabled={!canEditSettings}>
                      Delete All Data
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;