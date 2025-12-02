'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Header() {
    return (
        <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo/Brand */}
                    <div className="flex items-center">
                        <Link href="/" className="text-xl font-bold text-gray-900">
                            Boxing Gym CRM
                        </Link>
                    </div>


                    {/* User Menu */}
                    <div className="flex items-center">
                        <UserButton
                            afterSignOutUrl="/sign-in"
                            appearance={{
                                elements: {
                                    avatarBox: "h-10 w-10"
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </header>
    );
}
