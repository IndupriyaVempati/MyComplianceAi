import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'


export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Delete",
    cancelText = "Cancel",
    variant = "danger",
    maxWidthClass = "sm:max-w-[440px]"
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'success';
    maxWidthClass?: string;
}) {
    const isSuccess = variant === 'success';

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-[rgba(0,0,0,0.4)] transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel 
                                className={`relative transform overflow-hidden rounded-[16px] bg-white px-4 pb-4 pt-5 text-left transition-all sm:my-8 sm:w-full ${maxWidthClass} sm:p-6 border-none shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}
                            >
                                <div>
                                    <div className={`mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
                                        isSuccess ? 'bg-[#FEF3C7]' : 'bg-red-100'
                                    }`}>
                                        <ExclamationTriangleIcon className={`h-6 w-6 ${
                                            isSuccess ? 'text-[#D97706]' : 'text-red-600'
                                        }`} aria-hidden="true" />
                                    </div>
                                    <div className="mt-3 text-center sm:mt-5">
                                        <Dialog.Title as="h3" className="leading-6" style={{ color: '#00386B', fontWeight: '700', fontSize: '18px' }}>
                                            {title}
                                        </Dialog.Title>
                                        <div className="mt-2 text-center px-2">
                                            <div 
                                                className="whitespace-pre-line text-balance"
                                                style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.6' }}
                                            >
                                                {message}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex flex-row items-center justify-center gap-3">
                                    <button
                                        type="button"
                                        className="flex-1 py-[10px] rounded-[10px] text-[14px] font-[600] transition-all border-[1.5px] border-[#CBD5E1] text-[#334155] bg-transparent hover:bg-[#F1F5F9]"
                                        onClick={onClose}
                                    >
                                        {cancelText}
                                    </button>
                                    <button
                                        type="button"
                                        className="flex-1 py-[10px] rounded-[10px] text-[14px] font-[700] transition-all disabled:opacity-50 border-none"
                                        style={{ 
                                            backgroundColor: isSuccess ? '#059669' : '#DC2626',
                                            color: '#FFFFFF',
                                            boxShadow: isSuccess ? '0 2px 8px rgba(5,150,105,0.3)' : '0 2px 8px rgba(220,38,38,0.2)'
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = isSuccess ? '#047857' : '#B91C1C';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = isSuccess ? '#059669' : '#DC2626';
                                        }}
                                        onClick={() => {
                                            onConfirm();
                                            onClose();
                                        }}
                                    >
                                        {confirmText}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}
