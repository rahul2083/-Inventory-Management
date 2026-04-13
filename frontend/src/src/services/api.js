    import axios from 'axios';
    import { clearSession, getStoredToken } from '../utils/auth';

    const API_URL = 'http://localhost:5000/api';

    // =============================================
    // HELPERS
    // =============================================
    const toNumber = (val, fallback = 0) => {
        if (val === null || val === undefined || val === '') return fallback;
        const num = Number(val);
        return Number.isNaN(num) ? fallback : num;
    };

    const toNullableNumber = (val) => {
        if (val === null || val === undefined || val === '') return null;
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
    };

    const toTrimmedString = (val, fallback = '') => {
        if (val === null || val === undefined) return fallback;
        return String(val).trim();
    };

    const toNullableString = (val) => {
        const str = toTrimmedString(val, '');
        return str ? str : null;
    };

    const toBoolean = (val) => {
        return (
            val === true ||
            val === 1 ||
            val === '1' ||
            val === 'true' ||
            val === 'TRUE' ||
            val === 'Yes' ||
            val === 'YES' ||
            val === 'yes'
        );
    };

    const normalizeDispatchStatus = (status) => {
        const safeStatus = toTrimmedString(status, '');
        if (!safeStatus) return 'Pending';

        // Keep current business logic compatible with frontend
        if (safeStatus === 'Order Not Confirmed') return 'Order On Hold';

        return safeStatus;
    };

    const normalizeLogisticsStatus = (status) => {
        const safeStatus = toTrimmedString(status, '');
        if (!safeStatus) return null;

        // Backward compatibility
        if (safeStatus === 'Ready for Dispatch') return 'Packing in Process';

        return safeStatus;
    };

    // Create axios instance with default config
    const api = axios.create({
        baseURL: API_URL,
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    const withAuthHeaders = (config = {}) => {
        const nextConfig = { ...config };
        nextConfig.headers = { ...(config.headers || {}) };

        const token = getStoredToken();
        if (token) {
            nextConfig.headers.Authorization = `Bearer ${token}`;
        } else {
            delete nextConfig.headers.Authorization;
        }

        return nextConfig;
    };

    axios.interceptors.request.use(withAuthHeaders);
    api.interceptors.request.use(withAuthHeaders);

    // ✅ Response interceptor with preserved response
    api.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                clearSession();
            }

            console.error('API Error:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.message || error.message || 'Something went wrong';

            const enhancedError = new Error(errorMessage);
            enhancedError.response = error.response;
            return Promise.reject(enhancedError);
        }
    );

    export const printerService = {
        // =============================================
        // =============== AUTH =======================
        // =============================================
        // ... inside printerService object ...

    getProfile: async () => {
        const res = await api.get('/auth/profile');
        return res.data;
    },

    updateProfile: async (data) => {
        const payload = {
            fullName: toTrimmedString(data.fullName),
            email: toTrimmedString(data.email),
            phone: toTrimmedString(data.phone)
        };
        const res = await api.put('/auth/profile', payload);
        return res.data;
    },

    changePassword: async (data) => {
        const payload = {
            oldPassword: data.oldPassword,
            newPassword: data.newPassword
        };
        const res = await api.put('/auth/change-password', payload);
        return res.data;
    },

        getBootstrapStatus: async () => {
            const res = await api.get('/auth/bootstrap-status');
            return res.data;
        },

        login: async (credentials) => {
            const res = await api.post('/auth/login', credentials);
            return res.data;
        },

        signup: async (credentials) => {
            const res = await api.post('/auth/signup', credentials);
            return res.data;
        },

        getCurrentUser: async () => {
            const res = await api.get('/auth/me');
            return res.data;
        },

        logout: async () => {
            const res = await api.post('/auth/logout');
            return res.data;
        },

        getUsers: async () => {
            const res = await api.get('/users');
            return res.data;
        },

        createUser: async (data) => {
            const payload = {
                username: toTrimmedString(data.username),
                password: toTrimmedString(data.password),
                role: data.role || 'User'
            };

            const res = await api.post('/users', payload);
            return res.data;
        },

        updateUser: async (id, data) => {
            const payload = {
                username: toTrimmedString(data.username),
                role: data.role || 'User'
            };

            if (data.password) {
                payload.password = toTrimmedString(data.password);
            }

            const res = await api.put(`/users/${id}`, payload);
            return res.data;
        },

        deleteUser: async (id) => {
            const res = await api.delete(`/users/${id}`);
            return res.data;
        },

        getActivityLogs: async () => {
            const res = await api.get('/admin/activity-logs');
            return res.data;
        },

        // =============================================
        // =============== COMPANIES ==================
        // =============================================
        getCompanies: async () => {
            try {
                const res = await api.get(`/companies?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch companies:', error.message);
                return [];
            }
        },

        addCompany: async (data) => {
            const res = await api.post('/companies', data);
            return res.data;
        },

        updateCompany: async (id, data) => {
            const res = await api.put(`/companies/${id}`, data);
            return res.data;
        },

        deleteCompany: async (id) => {
            const res = await api.delete(`/companies/${id}`);
            return res.data;
        },

        // =============================================
        // =============== MODELS =====================
        // =============================================
        getModels: async () => {
            try {
                const res = await api.get(`/models?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch models:', error.message);
                return [];
            }
        },

        addModel: async (data) => {
            const payload = {
                name: toTrimmedString(data.name),
                company: toTrimmedString(data.company),
                category: data.category,
                colorType: data.colorType || 'Monochrome',
                printerType: data.printerType || 'Multi-Function',
                description: toTrimmedString(data.description, ''),
                mrp: toNumber(data.mrp),
                isSerialized: data.isSerialized !== false,
                stockQuantity: toNumber(data.stockQuantity),
                packagingCost: toNumber(data.packagingCost)
            };

            if (!payload.name || !payload.company) {
                throw new Error('Model name and company are required');
            }

            const res = await api.post('/models', payload);
            return res.data;
        },

        updateModel: async (id, data) => {
            const payload = {
                name: toTrimmedString(data.name),
                company: toTrimmedString(data.company),
                category: data.category,
                colorType: data.colorType || 'Monochrome',
                printerType: data.printerType || 'Multi-Function',
                description: toTrimmedString(data.description, ''),
                mrp: toNumber(data.mrp),
                isSerialized: data.isSerialized !== false,
                stockQuantity: toNumber(data.stockQuantity),
                packagingCost: toNumber(data.packagingCost)
            };

            const res = await api.put(`/models/${id}`, payload);
            return res.data;
        },

        onUpdateModel: async (id, data) => {
            return printerService.updateModel(id, data);
        },

        deleteModel: async (id) => {
            const res = await api.delete(`/models/${id}`);
            return res.data;
        },

        bulkDeleteModels: async (ids) => {
            const res = await api.post('/models/bulk-delete', { ids });
            return res.data;
        },

        // =============================================
        // =============== SERIALS ====================
        // =============================================
        getSerials: async () => {
            try {
                // ✅ FIX 1: Added cache busting timestamp to force fresh fetch after Excel Upload
                const res = await api.get(`/serials?_t=${new Date().getTime()}`);
                
                // ✅ FIX 2: Data Normalization ensuring Frontend gets what it expects
                return res.data.map(item => ({
                    ...item,
                    serialNumber: item.value || item.serialNumber, // Guarantee serialNumber property exists
                    model: item.modelName ? {
                        id: item.modelId,
                        name: item.modelName,
                        company: item.companyName,
                        category: item.modelCategory
                    } : null // Support UI expecting nested object
                }));
            } catch (error) {
                console.warn('Failed to fetch serials:', error.message);
                return [];
            }
        },

        addSerial: async (data) => {
            const payload = {
                modelId: toNumber(data.modelId),
                value: toTrimmedString(data.value || data.serialNumber),
                landingPrice: toNumber(data.landingPrice),
                landingPriceReason: toNullableString(data.landingPriceReason)
            };

            if (!payload.value || !payload.modelId) {
                throw new Error('Serial number and model are required');
            }

            const res = await api.post('/serials', payload);
            return res.data;
        },

        updateSerial: async (id, data) => {
            const payload = {
                value: toTrimmedString(data.value || data.serialNumber),
                landingPrice: toNumber(data.landingPrice),
                modelId: toNumber(data.modelId),
                landingPriceReason: toNullableString(data.landingPriceReason)
            };

            const res = await api.put(`/serials/${id}`, payload);
            return res.data;
        },

        deleteSerial: async (id) => {
            const res = await api.delete(`/serials/${id}`);
            return res.data;
        },

        bulkAddSerials: async (serials) => {
            const safeSerialsData = serials.map(s => ({
                ...s,
                value: s.value || s.serialNumber, // Fallback support
                landingPriceReason: toNullableString(s.landingPriceReason)
            }));
            const res = await api.post('/serials/bulk', { serials: safeSerialsData });
            return res.data;
        },

        bulkDeleteSerials: async (ids) => {
            const res = await api.post('/serials/bulk-delete', { ids });
            return res.data;
        },

        // =============================================
        // ✅ EXCEL UPLOAD / DOWNLOAD FOR SERIALS
        // =============================================
        
        // 🔥 UPDATE: Added targetModelId parameter for Model Filtering
        uploadSerialsExcel: async (file, targetModelId = "") => {
            console.log('📤 Uploading Excel file:', file.name, 'Target Model:', targetModelId || 'All Models');

            if (!file) {
                throw new Error('No file selected');
            }

            const formData = new FormData();
            formData.append('file', file);
            
            // ✅ Send targetModelId to backend if selected
            if (targetModelId) {
                formData.append('targetModelId', targetModelId);
            }

            try {
                const res = await api.post('/serials/upload-excel', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    timeout: 60000 // 60 seconds timeout for large files
                });

                console.log('✅ Excel upload successful:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ Excel upload failed:', error.message);
                throw error;
            }
        },

        downloadSerialTemplate: async () => {
            try {
                const res = await api.get('/serials/download-template', {
                    responseType: 'blob'
                });

                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'serial_upload_template.xlsx');
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);

                console.log('✅ Template downloaded successfully');
                return true;
            } catch (error) {
                console.error('❌ Template download failed:', error.message);
                throw error;
            }
        },

        exportSerialsExcel: async () => {
            try {
                const res = await api.get(`/serials/export-excel?_t=${new Date().getTime()}`, {
                    responseType: 'blob'
                });

                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `serials_export_${Date.now()}.xlsx`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);

                console.log('✅ Serials exported successfully');
                return true;
            } catch (error) {
                console.error('❌ Export failed:', error.message);
                throw error;
            }
        },

        // =============================================
        // =============== DISPATCHES =================
        // =============================================
        getDispatches: async (includeDeleted = true) => {
            try {
                const res = await api.get(`/dispatches?includeDeleted=${includeDeleted}&_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch dispatches:', error.message);
                return [];
            }
        },

        getDispatchById: async (id) => {
            try {
                const res = await api.get(`/dispatches/${id}?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn(`Failed to fetch dispatch details for ID ${id}:`, error.message);
                return null;
            }
        },

        getDispatchStats: async () => {
            try {
                const res = await api.get(`/dispatches/stats?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch dispatch stats:', error.message);
                return null;
            }
        },

        addDispatch: async (data) => {
            let safePackagingCost = null;
            if (data.packagingCost !== undefined && data.packagingCost !== '') {
                safePackagingCost = toNumber(data.packagingCost);
            }

            const normalizedStatus = normalizeDispatchStatus(data.status);

            const payload = {
                serialId: toNumber(data.serialId),
                firmName: toTrimmedString(data.firmName),
                customer: toTrimmedString(data.customer || data.customerName),
                customerName: toTrimmedString(data.customerName || data.customer),
                address: toTrimmedString(data.address || data.shippingAddress),
                shippingAddress: toTrimmedString(data.shippingAddress || data.address),
                user: data.user || data.dispatchedBy || 'Unknown',
                sellingPrice: toNumber(data.sellingPrice),
                status: normalizedStatus,
                remarks: toTrimmedString(data.remarks, ''),

                // backward compatibility
                orderVerified: data.orderVerified || 'No',

                orderType: data.orderType || data.gemOrderType || null,
                bidNo: data.bidNo || data.bidNumber || null,
                orderDate: data.orderDate || null,
                lastDeliveryDate: data.lastDeliveryDate || null,
                gstNumber: toNullableString(data.gstNumber),
                contactNumber: toNullableString(data.contactNumber),
                altContactNumber: toNullableString(data.altContactNumber),
                buyerEmail: toNullableString(data.buyerEmail),
                consigneeEmail: toNullableString(data.consigneeEmail),
                contractFile: data.contractFile || data.contractFilename || null,

                installationRequired: toBoolean(data.installationRequired),
                installationStatus: toBoolean(data.installationRequired)
                    ? (data.installationStatus || 'Pending')
                    : null,
                technicianName: toNullableString(data.technicianName),
                technicianContact: toNullableString(data.technicianContact),
                installationCharges: toNumber(data.installationCharges),
                installationRemarks: toNullableString(data.installationRemarks),
                scheduledDate: data.scheduledDate || null,

                // logistics compatibility
                courierPartner: toNullableString(data.courierPartner),
                logisticsDispatchDate: data.logisticsDispatchDate || null,
                trackingId: toNullableString(data.trackingId),
                freightCharges: toNumber(data.freightCharges),
                logisticsStatus: normalizeLogisticsStatus(data.logisticsStatus),
                podFilename: data.podFilename || null,
                ewayBillFilename: data.ewayBillFilename || null,

                packagingCost: safePackagingCost,
                commission: toNumber(data.commission)
            };

            const res = await api.post('/dispatches', payload);
            return res.data;
        },

        addBulkDispatch: async (items) => {
            const safeItems = items.map(item => {
                let safePackagingCost = null;
                if (item.packagingCost !== undefined && item.packagingCost !== '') {
                    safePackagingCost = toNumber(item.packagingCost);
                }

                return {
                    serialId: toNumber(item.serialId),
                    firmName: toTrimmedString(item.firmName),
                    customer: toTrimmedString(item.customer || item.customerName),
                    customerName: toTrimmedString(item.customerName || item.customer),
                    address: toTrimmedString(item.address || item.shippingAddress),
                    shippingAddress: toTrimmedString(item.shippingAddress || item.address),
                    user: item.user || 'Unknown',
                    sellingPrice: toNumber(item.sellingPrice),
                    status: normalizeDispatchStatus(item.status || 'Pending'),

                    orderVerified: item.orderVerified || 'No',
                    orderType: item.orderType || item.gemOrderType || null,
                    bidNo: item.bidNo || item.bidNumber || null,
                    orderDate: item.orderDate || null,
                    lastDeliveryDate: item.lastDeliveryDate || null,
                    gstNumber: toNullableString(item.gstNumber),
                    contactNumber: toNullableString(item.contactNumber),
                    altContactNumber: toNullableString(item.altContactNumber),
                    buyerEmail: toNullableString(item.buyerEmail),
                    consigneeEmail: toNullableString(item.consigneeEmail),
                    contractFile: item.contractFile || item.contractFilename || null,

                    installationRequired: toBoolean(item.installationRequired),
                    installationStatus: toBoolean(item.installationRequired)
                        ? (item.installationStatus || 'Pending')
                        : null,
                    technicianName: toNullableString(item.technicianName),
                    technicianContact: toNullableString(item.technicianContact),
                    installationCharges: toNumber(item.installationCharges),
                    installationRemarks: toNullableString(item.installationRemarks),
                    scheduledDate: item.scheduledDate || null,

                    courierPartner: toNullableString(item.courierPartner),
                    logisticsDispatchDate: item.logisticsDispatchDate || null,
                    trackingId: toNullableString(item.trackingId),
                    freightCharges: toNumber(item.freightCharges),
                    logisticsStatus: normalizeLogisticsStatus(item.logisticsStatus),
                    podFilename: item.podFilename || null,
                    ewayBillFilename: item.ewayBillFilename || null,

                    packagingCost: safePackagingCost,
                    commission: toNumber(item.commission)
                };
            });

            const res = await api.post('/dispatches/bulk', { items: safeItems });
            return res.data;
        },

        updateDispatch: async (id, updates) => {
            if (!updates && !id) return null;

            // bulk payload support exactly like Dispatch.jsx uses
            if (!id && Array.isArray(updates)) {
                const normalizedUpdates = updates.map((item) => {
                    const payload = { ...item };

                    if (payload.status !== undefined) {
                        payload.status = normalizeDispatchStatus(payload.status);
                    }
                    if (payload.logisticsStatus !== undefined) {
                        payload.logisticsStatus = normalizeLogisticsStatus(payload.logisticsStatus);
                    }
                    if (payload.installationRequired !== undefined) {
                        payload.installationRequired = toBoolean(payload.installationRequired);
                    }
                    if (payload.installationCharges !== undefined) {
                        payload.installationCharges = toNumber(payload.installationCharges);
                    }
                    if (payload.packagingCost !== undefined) {
                        payload.packagingCost = toNumber(payload.packagingCost);
                    }
                    if (payload.commission !== undefined) {
                        payload.commission = toNumber(payload.commission);
                    }
                    if (payload.freightCharges !== undefined) {
                        payload.freightCharges = toNumber(payload.freightCharges);
                    }
                    if (payload.sellingPrice !== undefined) {
                        payload.sellingPrice = toNumber(payload.sellingPrice);
                    }
                    if (payload.technicianName !== undefined) {
                        payload.technicianName = toNullableString(payload.technicianName);
                    }
                    if (payload.technicianContact !== undefined) {
                        payload.technicianContact = toNullableString(payload.technicianContact);
                    }
                    if (payload.installationRemarks !== undefined) {
                        payload.installationRemarks = toNullableString(payload.installationRemarks);
                    }
                    if (payload.contactNumber !== undefined) {
                        payload.contactNumber = toNullableString(payload.contactNumber);
                    }
                    if (payload.altContactNumber !== undefined) {
                        payload.altContactNumber = toNullableString(payload.altContactNumber);
                    }
                    if (payload.buyerEmail !== undefined) {
                        payload.buyerEmail = toNullableString(payload.buyerEmail);
                    }
                    if (payload.consigneeEmail !== undefined) {
                        payload.consigneeEmail = toNullableString(payload.consigneeEmail);
                    }
                    if (payload.gstNumber !== undefined) {
                        payload.gstNumber = toNullableString(payload.gstNumber);
                    }
                    if (payload.customer !== undefined || payload.customerName !== undefined) {
                        payload.customer = toTrimmedString(payload.customer || payload.customerName);
                        payload.customerName = toTrimmedString(payload.customerName || payload.customer);
                    }
                    if (payload.address !== undefined || payload.shippingAddress !== undefined) {
                        payload.address = toTrimmedString(payload.address || payload.shippingAddress);
                        payload.shippingAddress = toTrimmedString(payload.shippingAddress || payload.address);
                    }

                    return payload;
                });

                const res = await api.put('/dispatches', { updates: normalizedUpdates });
                return res.data;
            }

            const payload = { ...updates };

            if (payload.status !== undefined) payload.status = normalizeDispatchStatus(payload.status);
            if (payload.logisticsStatus !== undefined) payload.logisticsStatus = normalizeLogisticsStatus(payload.logisticsStatus);
            if (payload.installationRequired !== undefined) payload.installationRequired = toBoolean(payload.installationRequired);
            if (payload.installationCharges !== undefined) payload.installationCharges = toNumber(payload.installationCharges);
            if (payload.packagingCost !== undefined) payload.packagingCost = toNumber(payload.packagingCost);
            if (payload.commission !== undefined) payload.commission = toNumber(payload.commission);
            if (payload.freightCharges !== undefined) payload.freightCharges = toNumber(payload.freightCharges);
            if (payload.sellingPrice !== undefined) payload.sellingPrice = toNumber(payload.sellingPrice);

            if (payload.technicianName !== undefined) payload.technicianName = toNullableString(payload.technicianName);
            if (payload.technicianContact !== undefined) payload.technicianContact = toNullableString(payload.technicianContact);
            if (payload.installationRemarks !== undefined) payload.installationRemarks = toNullableString(payload.installationRemarks);
            if (payload.contactNumber !== undefined) payload.contactNumber = toNullableString(payload.contactNumber);
            if (payload.altContactNumber !== undefined) payload.altContactNumber = toNullableString(payload.altContactNumber);
            if (payload.buyerEmail !== undefined) payload.buyerEmail = toNullableString(payload.buyerEmail);
            if (payload.consigneeEmail !== undefined) payload.consigneeEmail = toNullableString(payload.consigneeEmail);
            if (payload.gstNumber !== undefined) payload.gstNumber = toNullableString(payload.gstNumber);

            if (payload.customer !== undefined || payload.customerName !== undefined) {
                payload.customer = toTrimmedString(payload.customer || payload.customerName);
                payload.customerName = toTrimmedString(payload.customerName || payload.customer);
            }

            if (payload.address !== undefined || payload.shippingAddress !== undefined) {
                payload.address = toTrimmedString(payload.address || payload.shippingAddress);
                payload.shippingAddress = toTrimmedString(payload.shippingAddress || payload.address);
            }

            if (id) {
                const res = await api.put(`/dispatches/${id}`, payload);
                return res.data;
            } else {
                const res = await api.put('/dispatches', { updates: payload });
                return res.data;
            }
        },

        updateTransaction: async (id, data) => {
            return printerService.updateDispatch(id, data);
        },

        deleteDispatch: async (ids, reason, cancelledBy) => {
            const res = await api.delete('/dispatches', {
                data: {
                    ids: Array.isArray(ids) ? ids : [ids],
                    reason: reason || 'No reason provided',
                    cancelledBy: cancelledBy || 'Unknown'
                }
            });
            return res.data;
        },

        restoreDispatch: async (ids) => {
            const res = await api.post('/dispatches/restore', {
                ids: Array.isArray(ids) ? ids : [ids]
            });
            return res.data;
        },

        permanentDeleteDispatch: async (ids) => {
            const res = await api.delete('/dispatches/permanent', {
                data: { ids: Array.isArray(ids) ? ids : [ids] }
            });
            return res.data;
        },

        // =============================================
        // ✅ INSTALLATIONS
        // =============================================
        getInstallations: async () => {
            try {
                const res = await api.get(`/installations?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch installations:', error.message);
                return [];
            }
        },

        getInstallationStats: async () => {
            try {
                const res = await api.get(`/installations/stats?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch installation stats:', error.message);
                return {
                    total: 0,
                    pending: 0,
                    scheduled: 0,
                    inProgress: 0,
                    completed: 0,
                    cancelled: 0,
                    totalCharges: 0
                };
            }
        },

        getInstallationById: async (id) => {
            const res = await api.get(`/installations/${id}?_t=${new Date().getTime()}`);
            return res.data;
        },

        updateInstallation: async (id, data) => {
            const payload = {
                technicianName: toNullableString(data.technicianName),
                technicianContact: toNullableString(data.technicianContact),
                installationStatus: data.installationStatus || null,
                installationCharges: toNumber(data.installationCharges),
                installationRemarks: toNullableString(data.installationRemarks),
                scheduledDate: data.scheduledDate || null,
                installationDate: data.installationDate || null
            };

            const res = await api.put(`/installations/${id}`, payload);
            return res.data;
        },

        bulkUpdateInstallations: async (ids, updates) => {
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                throw new Error('No IDs provided');
            }

            const payload = {
                ids,
                updates: {
                    technicianName: updates.technicianName?.trim() || undefined,
                    technicianContact: updates.technicianContact?.trim() || undefined,
                    installationStatus: updates.installationStatus || undefined,
                    scheduledDate: updates.scheduledDate || undefined
                }
            };

            const res = await api.put('/installations/bulk/update', payload);
            return res.data;
        },

        // =============================================
        // =============== RETURNS ====================
        // =============================================
        getReturns: async () => {
            try {
                console.log('📥 Fetching returns...');
                const res = await api.get(`/returns?_t=${new Date().getTime()}`);
                console.log('✅ Returns fetched:', res.data?.length || 0, 'records');
                return res.data;
            } catch (error) {
                console.error('❌ Failed to fetch returns:', error.message);
                console.error('Full error:', error.response?.data);
                return [];
            }
        },

        addReturn: async (data, conditionParam, reasonParam) => {
            console.log('📤 Adding return - Raw input:', { data, conditionParam, reasonParam });

            let payload;

            if (typeof data === 'object' && data !== null && !conditionParam) {
                payload = {
                    serialValue: (data.serialValue || data.serialNumber || data.serial)?.toString().trim(),
                    condition: data.condition || 'Good',
                    reason: (data.reason || data.remarks || '')?.toString().trim(),
                    dispatchId: data.dispatchId || null,
                    returnDate: data.returnDate || new Date().toISOString(),
                    returnedBy: data.returnedBy || data.user || 'Unknown'
                };
            } else {
                payload = {
                    serialValue: data?.toString().trim(),
                    condition: conditionParam || 'Good',
                    reason: (reasonParam || '')?.toString().trim(),
                    returnDate: new Date().toISOString(),
                    returnedBy: 'Unknown'
                };
            }

            console.log('📦 Return payload:', payload);

            if (!payload.serialValue) {
                throw new Error('Serial number is required for return');
            }

            const validConditions = ['Good', 'Damaged', 'Defective', 'Refurbished', 'Other'];
            if (!validConditions.includes(payload.condition)) {
                console.warn(`⚠️ Invalid condition "${payload.condition}", defaulting to "Good"`);
                payload.condition = 'Good';
            }

            try {
                const res = await api.post('/returns', payload);
                console.log('✅ Return added successfully:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ Failed to add return:', error.message);
                console.error('Response:', error.response?.data);
                console.error('Status:', error.response?.status);
                throw error;
            }
        },

        updateReturn: async (id, data) => {
            console.log('📝 Updating return:', { id, data });

            if (!id) {
                throw new Error('Return ID is required for update');
            }

            const payload = {
                condition: data.condition,
                reason: data.reason?.trim() || data.remarks?.trim() || '',
                status: data.status,
                ...(data.restoredToStock !== undefined && { restoredToStock: data.restoredToStock })
            };

            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) delete payload[key];
            });

            try {
                const res = await api.put(`/returns/${id}`, payload);
                console.log('✅ Return updated successfully:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ Failed to update return:', error.message);
                console.error('Response:', error.response?.data);
                throw error;
            }
        },

        deleteReturn: async (item) => {
            console.log('🗑️ Deleting return - Raw input:', item);

            let id = null;

            if (typeof item === 'string' || typeof item === 'number') {
                id = item;
            } else if (item && typeof item === 'object') {
                id = item._id || item.id || item.returnId || item.return_id || item.Id || item.ID;
            }

            console.log('🔑 Extracted ID:', id);

            if (!id) {
                console.error('❌ No valid ID found. Full item received:', JSON.stringify(item, null, 2));
                throw new Error('No valid ID found for this return record. Please refresh and try again.');
            }

            try {
                const res = await api.delete(`/returns/${id}`);
                console.log('✅ Return deleted successfully:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ Failed to delete return:', error.message);
                console.error('Response:', error.response?.data);
                console.error('Status:', error.response?.status);

                if (error.response?.status === 404) {
                    throw new Error('Return record not found. It may have been already deleted.');
                }
                throw error;
            }
        },

        bulkDeleteReturns: async (ids) => {
            console.log('🗑️ Bulk deleting returns:', ids);

            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                throw new Error('No IDs provided for bulk delete');
            }

            try {
                const res = await api.post('/returns/bulk-delete', { ids });
                console.log('✅ Bulk delete successful:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ Failed to bulk delete returns:', error.message);
                throw error;
            }
        },

        restoreReturnToStock: async (id) => {
            console.log('🔄 Restoring return to stock:', id);

            if (!id) {
                throw new Error('Return ID is required');
            }

            try {
                const res = await api.post(`/returns/${id}/restore-to-stock`);
                console.log('✅ Restored to stock:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ Failed to restore to stock:', error.message);
                throw error;
            }
        },

        getReturnById: async (id) => {
            console.log('📥 Fetching return by ID:', id);

            if (!id) {
                throw new Error('Return ID is required');
            }

            try {
                const res = await api.get(`/returns/${id}?_t=${new Date().getTime()}`);
                console.log('✅ Return fetched:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ Failed to fetch return:', error.message);
                throw error;
            }
        },

        getReturnStats: async () => {
            try {
                const res = await api.get(`/returns/stats?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch return stats:', error.message);
                return {
                    total: 0,
                    good: 0,
                    damaged: 0,
                    defective: 0,
                    restoredToStock: 0
                };
            }
        },

        // =============================================
        // =============== REPORTS ====================
        // =============================================
        getReports: async (startDate, endDate) => {
            try {
                const params = new URLSearchParams();
                if (startDate) params.append('startDate', startDate);
                if (endDate) params.append('endDate', endDate);
                params.append('_t', new Date().getTime());

                const res = await api.get(`/reports?${params.toString()}`);

                if (res.data && res.data.transactions) {
                    res.data.transactions = res.data.transactions.map(t => ({
                        ...t,
                        customerName: t.customerName || t.customer || t.customer_name || "N/A"
                    }));
                }

                return res.data;
            } catch (error) {
                console.warn('Failed to fetch reports:', error.message);
                return null;
            }
        },

        getInventoryReport: async () => {
            const res = await api.get(`/reports/inventory?_t=${new Date().getTime()}`);
            return res.data;
        },

        getSalesReport: async (startDate, endDate) => {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            params.append('_t', new Date().getTime());

            const res = await api.get(`/reports/sales?${params.toString()}`);
            return res.data;
        },

        getInstallationReport: async (startDate, endDate) => {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            params.append('_t', new Date().getTime());

            const res = await api.get(`/reports/installations?${params.toString()}`);
            return res.data;
        },

        // =============================================
        // =============== ORDERS TRACKING ============
        // =============================================
        getOrders: async () => {
            try {
                const res = await api.get(`/orders?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn("Error fetching orders:", error.message);
                return [];
            }
        },

        updateOrderStatus: async (id, statusData) => {
            const payload = {
                status: normalizeDispatchStatus(statusData.status),
                trackingId: toTrimmedString(statusData.trackingId, ''),
                reason: toNullableString(statusData.reason)
            };

            const res = await api.put(`/orders/${id}/status`, payload);
            return res.data;
        },

        updatePayment: async (id, paymentData) => {
            const payload = {
                paymentDate: paymentData.paymentDate,
                amount: toNumber(paymentData.amount),
                utrId: toNullableString(paymentData.utrId),
                status: 'Completed'
            };

            const res = await api.put(`/orders/${id}/payment`, payload);
            return res.data;
        },

        // =============================================
        // ✅ uploadOrderDocument
        // =============================================
        uploadOrderDocument: async (id, file, docType) => {
            console.log(`📤 Uploading document — ID: ${id}, DocType: ${docType}, File: ${file?.name}`);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('docType', docType);

            try {
                const res = await api.post(`/orders/${id}/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                console.log(`✅ Upload successful [${docType}]:`, res.data);
                return res.data;
            } catch (error) {
                console.error(`❌ Upload failed [${docType}]:`, error.message);
                console.error('Response:', error.response?.data);
                throw error;
            }
        },

        uploadEwayBill: async (dispatchId, file) => {
            console.log(`📤 Uploading E-Way Bill — Dispatch ID: ${dispatchId}, File: ${file?.name}`);

            if (!dispatchId) throw new Error('Dispatch ID is required for E-Way Bill upload');
            if (!file) throw new Error('File is required for E-Way Bill upload');

            const allowedTypes = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/webp'
            ];

            if (!allowedTypes.includes(file.type)) {
                throw new Error('Invalid file type. Only PDF, JPG, PNG, and WEBP are allowed for E-Way Bill.');
            }

            const maxSizeBytes = 10 * 1024 * 1024;
            if (file.size > maxSizeBytes) {
                throw new Error('File size exceeds 10MB limit.');
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('docType', 'ewayBill');

            try {
                const res = await api.post(`/orders/${dispatchId}/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                console.log('✅ E-Way Bill uploaded successfully:', res.data);
                return res.data;
            } catch (error) {
                console.error('❌ E-Way Bill upload failed:', error.message);
                console.error('Response:', error.response?.data);
                throw error;
            }
        },

        getEwayBillUrl: (filename) => {
            if (!filename) return null;
            return `http://localhost:5000/uploads/${filename}`;
        },

        validateEwayBillRequired: (orderValue) => {
            const threshold = 50000;
            const isRequired = Number(orderValue) > threshold;
            return {
                isRequired,
                threshold,
                message: isRequired
                    ? `E-Way Bill is mandatory for orders above ₹${threshold.toLocaleString('en-IN')}`
                    : null
            };
        },

        // =============================================
        // =============== DASHBOARD ==================
        // =============================================
        getDashboardStats: async () => {
            try {
                const res = await api.get(`/dashboard/stats?_t=${new Date().getTime()}`);
                return res.data;
            } catch (error) {
                console.warn('Failed to fetch dashboard stats:', error.message);
                return null;
            }
        },

        // =============================================
        // =============== SEARCH =====================
        // =============================================
        searchItems: async (query, type = 'all') => {
            const params = new URLSearchParams();
            params.append('q', query);
            params.append('type', type);

            const res = await api.get(`/search?${params.toString()}`);
            return res.data;
        },

        // =============================================
        // =============== EXPORT =====================
        // =============================================
        exportData: async (type, format = 'csv', filters = {}) => {
            const params = new URLSearchParams();
            params.append('format', format);
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });

            const res = await api.get(`/export/${type}?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}_${Date.now()}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            return true;
        },

        exportInstallations: async (format = 'csv', filters = {}) => {
            const params = new URLSearchParams();
            params.append('format', format);
            if (filters.status) params.append('status', filters.status);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const res = await api.get(`/export/installations?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `installations_${Date.now()}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            return true;
        },

        exportReturns: async (format = 'csv', filters = {}) => {
            const params = new URLSearchParams();
            params.append('format', format);
            if (filters.condition) params.append('condition', filters.condition);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const res = await api.get(`/export/returns?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `returns_${Date.now()}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            return true;
        },

        exportDispatches: async (format = 'csv', filters = {}) => {
            const params = new URLSearchParams();
            params.append('format', format);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.status) params.append('status', filters.status);

            const res = await api.get(`/export/dispatches?${params.toString()}`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `dispatches_${Date.now()}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            return true;
        }
    };

    export default api;
