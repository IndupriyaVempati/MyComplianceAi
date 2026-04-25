import { Fragment, ReactNode } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export function Layout(props: {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  sidebar: ReactNode;
  rightSidebar?: ReactNode;
  children: ReactNode;
  subtitle?: ReactNode;
}) {
  const sidebarContent = (
    <div className="flex grow flex-col h-full overflow-hidden">
      {/* Sidebar nav area */}
      <nav className="flex flex-1 flex-col overflow-y-auto">
        {props.sidebar}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-page dark:bg-[#212121] overflow-hidden transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      <Transition.Root show={props.sidebarOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50 lg:hidden"
          onClose={props.setSidebarOpen}
        >
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-64 flex-col bg-[#00386B]">
                <div className="absolute right-0 top-0 -mr-10 pt-4">
                  <button
                    type="button"
                    className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none"
                    onClick={() => props.setSidebarOpen(false)}
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 hover:text-gray-900 dark:text-[#ececec] dark:hover:text-white" aria-hidden="true" />
                  </button>
                </div>
                {sidebarContent}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#00386B]">
        {sidebarContent}
      </div>

      {/* Main content area */}
      <div className={`flex flex-1 flex-col min-w-0 overflow-hidden lg:pl-64 ${props.rightSidebar ? 'lg:pr-72' : ''} bg-bg-page dark:bg-[#212121] transition-colors duration-300`}>
        {/* Mobile top bar */}
        <div className="sticky top-0 z-40 flex items-center justify-between h-12 bg-white border-b border-[#E2E8F0] px-4 lg:hidden dark:bg-[#212121] dark:border-transparent">
          <button
            type="button"
            className="text-gray-500 hover:text-gray-900 p-1 dark:text-[#ececec] dark:hover:text-white"
            onClick={() => props.setSidebarOpen(true)}
          >
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>
          {props.subtitle && (
            <span className="ml-3 text-sm font-medium text-gray-900 truncate dark:text-[#ececec]">
              {props.subtitle}
            </span>
          )}
          {props.rightSidebar && (
            <button
              type="button"
              className="text-gray-500 hover:text-gray-900 p-1 dark:text-[#ececec] dark:hover:text-white ml-auto"
              onClick={() => props.setRightSidebarOpen(true)}
            >
              <Bars3Icon className="h-5 w-5 transform rotate-180" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Page content */}
        <main className="flex flex-1 flex-col overflow-y-auto min-w-0">
          {props.children}
        </main>
      </div>

      {/* Static right sidebar for desktop */}
      {props.rightSidebar && (
        <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 bg-white border-l border-gray-200 dark:bg-[#171717] dark:border-transparent">
          <div className="flex grow flex-col h-full overflow-hidden">
            {props.rightSidebar}
          </div>
        </div>
      )}

      {/* Mobile Right sidebar overlay */}
      {props.rightSidebar && (
        <Transition.Root show={props.rightSidebarOpen} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50 lg:hidden"
            onClose={props.setRightSidebarOpen}
          >
            <Transition.Child
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/60" />
            </Transition.Child>

            <div className="fixed inset-0 flex justify-end">
              <Transition.Child
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="relative flex w-72 flex-col bg-white dark:bg-[#171717]">
                  <div className="absolute left-0 top-0 -ml-10 pt-4">
                    <button
                      type="button"
                      className="mr-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none"
                      onClick={() => props.setRightSidebarOpen(false)}
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-500 hover:text-gray-900 dark:text-[#ececec] dark:hover:text-white" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex grow flex-col h-full overflow-hidden">
                    {props.rightSidebar}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>
      )}
    </div>
  );
}
